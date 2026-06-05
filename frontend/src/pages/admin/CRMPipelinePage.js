import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineArrowPathRoundedSquare, HiOutlineArrowsUpDown, HiOutlineClock, HiOutlineFire } from 'react-icons/hi2';
import { getCRMPipeline, updateCRMContact, updateCRMContactStage } from '../../api/crm';
import CRMSectionNav from '../../components/crm/CRMSectionNav';
import {
  formatCRMDateTime,
  getContactPrimaryChannel,
  getCRMEventMeta,
  getCRMStatusMeta,
  getCRMTaskStatusMeta
} from '../../components/crm/crmUi';
import { useAuth } from '../../context/AuthContext';

const COLUMN_ORDER = ['new_lead', 'contacted', 'link_sent', 'interested', 'cart_abandoned', 'customer', 'vip', 'inactive'];
const ENTRY_SPOTLIGHT_STATUSES = ['new_lead', 'contacted', 'link_sent', 'interested', 'cart_abandoned'];

const isWithinWindow = (value, windowMs) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= windowMs;
};

const getContactSpotlight = (
  contact,
  {
    recentEntryHours = 36,
    newCustomerHighlightDays = 7
  } = {}
) => {
  const isRecentEntry =
    ENTRY_SPOTLIGHT_STATUSES.includes(contact?.status) &&
    isWithinWindow(contact?.createdAt, Number(recentEntryHours || 36) * 60 * 60 * 1000);

  const isNewCustomer =
    ['customer', 'vip'].includes(contact?.status) &&
    Number(contact?.ordersCount || 0) <= 1 &&
    isWithinWindow(
      contact?.lastPurchasedAt || contact?.updatedAt,
      Number(newCustomerHighlightDays || 7) * 24 * 60 * 60 * 1000
    );

  return {
    isRecentEntry,
    isNewCustomer,
    hasSpotlight: isRecentEntry || isNewCustomer
  };
};

const CRMPipelinePage = () => {
  const { hasPermission } = useAuth();
  const canManagePipeline = hasPermission('crm.pipelineManage');
  const canEditContacts = hasPermission('crm.contactsEdit');

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [draggedContactId, setDraggedContactId] = useState('');
  const [dropColumnKey, setDropColumnKey] = useState('');
  const [savingContactId, setSavingContactId] = useState('');
  const [selectedMobileColumn, setSelectedMobileColumn] = useState(COLUMN_ORDER[0]);
  const [selectedMobileCardIndex, setSelectedMobileCardIndex] = useState(0);
  const [desktopColumnIndexes, setDesktopColumnIndexes] = useState({});
  const [spotlightConfig, setSpotlightConfig] = useState({
    recentEntryHours: 36,
    newCustomerHighlightDays: 7
  });

  useEffect(() => {
    getCRMPipeline()
      .then(data => {
        const nextContacts = Array.isArray(data) ? data : Array.isArray(data?.contacts) ? data.contacts : [];
        setContacts(nextContacts);
        if (data?.spotlightConfig) {
          setSpotlightConfig({
            recentEntryHours: Number(data.spotlightConfig.recentEntryHours || 36),
            newCustomerHighlightDays: Number(data.spotlightConfig.newCustomerHighlightDays || 7)
          });
        }
        setError('');
      })
      .catch(() => {
        setError('No se pudo cargar el pipeline CRM.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const grouped = useMemo(
    () =>
      COLUMN_ORDER.reduce((acc, key) => {
        acc[key] = contacts.filter(contact => contact.status === key);
        return acc;
      }, {}),
    [contacts]
  );

  const pipelineSummary = useMemo(
    () => ({
      total: contacts.length,
      hot: contacts.filter(contact => ['new_lead', 'interested', 'cart_abandoned'].includes(contact.status)).length,
      withTask: contacts.filter(contact => contact.nextTask?._id).length
    }),
    [contacts]
  );

  const spotlightSummary = useMemo(
    () => ({
      recentEntries: contacts.filter(contact => getContactSpotlight(contact, spotlightConfig).isRecentEntry).length,
      newCustomers: contacts.filter(contact => getContactSpotlight(contact, spotlightConfig).isNewCustomer).length
    }),
    [contacts, spotlightConfig]
  );

  useEffect(() => {
    const hasContactsInCurrentColumn = (grouped[selectedMobileColumn] || []).length > 0;
    if (hasContactsInCurrentColumn) {
      return;
    }

    const firstColumnWithContacts = COLUMN_ORDER.find(columnKey => (grouped[columnKey] || []).length > 0);
    if (firstColumnWithContacts && firstColumnWithContacts !== selectedMobileColumn) {
      setSelectedMobileColumn(firstColumnWithContacts);
    }
  }, [grouped, selectedMobileColumn]);

  useEffect(() => {
    setSelectedMobileCardIndex(0);
  }, [selectedMobileColumn]);

  useEffect(() => {
    const currentColumnCount = (grouped[selectedMobileColumn] || []).length;
    if (currentColumnCount === 0) {
      if (selectedMobileCardIndex !== 0) {
        setSelectedMobileCardIndex(0);
      }
      return;
    }

    if (selectedMobileCardIndex > currentColumnCount - 1) {
      setSelectedMobileCardIndex(currentColumnCount - 1);
    }
  }, [grouped, selectedMobileCardIndex, selectedMobileColumn]);

  useEffect(() => {
    setDesktopColumnIndexes(previous => {
      const next = { ...previous };
      let changed = false;

      COLUMN_ORDER.forEach(columnKey => {
        const count = (grouped[columnKey] || []).length;
        const currentIndex = Number.isInteger(next[columnKey]) ? next[columnKey] : 0;

        if (count <= 0) {
          if (next[columnKey] !== 0 && next[columnKey] !== undefined) {
            next[columnKey] = 0;
            changed = true;
          }
          return;
        }

        const clamped = Math.min(Math.max(currentIndex, 0), count - 1);
        if (clamped !== currentIndex || next[columnKey] === undefined) {
          next[columnKey] = clamped;
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [grouped]);

  const updateContactStage = async (contactId, nextStatus) => {
    const currentContact = contacts.find(contact => contact._id === contactId);
    if (!currentContact || currentContact.status === nextStatus || !(canManagePipeline || canEditContacts)) {
      return;
    }

    const previousStatus = currentContact.status;
    const nextStatusLabel = getCRMStatusMeta(nextStatus).label;

    setActionMessage('');
    setError('');
    setSavingContactId(contactId);
    setContacts(prev =>
      prev.map(contact =>
        contact._id === contactId
          ? {
              ...contact,
              status: nextStatus
            }
          : contact
      )
    );

    try {
      if (canManagePipeline) {
        try {
          await updateCRMContactStage(contactId, nextStatus);
        } catch (requestError) {
          const statusCode = requestError?.response?.status;
          if ((statusCode === 403 || statusCode === 404) && canEditContacts) {
            await updateCRMContact(contactId, { status: nextStatus });
          } else {
            throw requestError;
          }
        }
      } else if (canEditContacts) {
        await updateCRMContact(contactId, { status: nextStatus });
      }
      setActionMessage(`Contacto movido a ${nextStatusLabel}.`);
    } catch (requestError) {
      setContacts(prev =>
        prev.map(contact =>
          contact._id === contactId
            ? {
                ...contact,
                status: previousStatus
              }
            : contact
        )
      );
      setError(requestError?.response?.data?.message || 'No se pudo mover el contacto entre etapas.');
    } finally {
      setSavingContactId('');
      setDraggedContactId('');
      setDropColumnKey('');
    }
  };

  const handleDragStart = (event, contact) => {
    if (!canManagePipeline) {
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', contact._id);
    setDraggedContactId(contact._id);
    setActionMessage('');
  };

  const handleDragEnd = () => {
    setDraggedContactId('');
    setDropColumnKey('');
  };

  const handleDragOver = (event, columnKey) => {
    if (!canManagePipeline || !draggedContactId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropColumnKey(columnKey);
  };

  const handleDrop = async (event, columnKey) => {
    if (!canManagePipeline || !draggedContactId) {
      return;
    }

    event.preventDefault();
    await updateContactStage(draggedContactId, columnKey);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando pipeline...</div>;
  }

  if (error && !contacts.length) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }

  const renderContactCard = contact => {
    const eventMeta = getCRMEventMeta(contact.lastEventType);
    const nextTaskMeta = getCRMTaskStatusMeta(contact.nextTask?.status);
    const isDragging = draggedContactId === contact._id;
    const isSaving = savingContactId === contact._id;
    const spotlight = getContactSpotlight(contact, spotlightConfig);

    return (
      <article
        key={contact._id}
        draggable={canManagePipeline}
        onDragStart={event => handleDragStart(event, contact)}
        onDragEnd={handleDragEnd}
        className={`rounded-2xl border border-white/90 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-sm ${
          canManagePipeline ? 'cursor-grab active:cursor-grabbing' : ''
        } ${isDragging ? 'opacity-50 shadow-none' : ''} ${
          spotlight.isRecentEntry
            ? 'ring-2 ring-amber-200 shadow-[0_16px_35px_rgba(245,158,11,0.12)]'
            : spotlight.isNewCustomer
              ? 'ring-2 ring-emerald-200 shadow-[0_16px_35px_rgba(16,185,129,0.12)]'
              : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold leading-tight text-slate-950">{contact.name || 'Sin nombre'}</p>
            <p className="mt-0.5 text-sm text-slate-500">{getContactPrimaryChannel(contact)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {spotlight.isRecentEntry ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                Entrada nueva
              </span>
            ) : null}
            {spotlight.isNewCustomer ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                Cliente nuevo
              </span>
            ) : null}
            {contact.leadCode ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {contact.leadCode}
              </span>
            ) : null}
            {isSaving ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                Guardando...
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-sm text-slate-600">
          {contact.nextActionRequired ? (
            <span className="inline-flex w-fit rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-700 ring-1 ring-inset ring-orange-200">
              Falta siguiente accion
            </span>
          ) : null}
          <div className="flex items-start gap-2">
            <HiOutlineArrowPathRoundedSquare className="mt-0.5 text-base text-slate-400" />
            <div>
              <p className={`font-medium ${eventMeta.toneClassName}`}>{eventMeta.label}</p>
              <p className="text-xs text-slate-400">{formatCRMDateTime(contact.lastEventAt)}</p>
            </div>
          </div>

          {contact.nextTask?.title ? (
            <div className="flex items-start gap-2">
              <HiOutlineClock className="mt-0.5 text-base text-slate-400" />
              <div>
                <p className="line-clamp-1 font-medium text-slate-800">{contact.nextTask.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${nextTaskMeta.badgeClassName}`}>
                    {nextTaskMeta.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatCRMDateTime(contact.nextTask.dueDate)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <HiOutlineFire className="mt-0.5 text-base text-amber-500" />
              <p className="text-xs font-medium text-amber-700">Sin proxima tarea definida.</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {getCRMStatusMeta(contact.status).label}
            </span>
            <Link to={`/crm/contactos/${contact._id}`} className="text-sm font-semibold text-brand hover:text-brand-dark">
              Abrir ficha
            </Link>
          </div>

          {canManagePipeline ? (
            <label className="text-[11px] text-slate-500">
              Mover rapido
              <select
                value={contact.status}
                onChange={event => updateContactStage(contact._id, event.target.value)}
                className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 text-sm"
                disabled={isSaving}
              >
                {COLUMN_ORDER.map(option => (
                  <option key={option} value={option}>
                    {getCRMStatusMeta(option).label}
                  </option>
                ))}
              </select>
            </label>
          ) : canEditContacts ? (
            <label className="text-[11px] text-slate-500">
              Cambiar etapa
              <select
                value={contact.status}
                onChange={event => updateContactStage(contact._id, event.target.value)}
                className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 text-sm"
                disabled={isSaving}
              >
                {COLUMN_ORDER.map(option => (
                  <option key={option} value={option}>
                    {getCRMStatusMeta(option).label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </article>
    );
  };

  const renderColumn = columnKey => {
    const statusMeta = getCRMStatusMeta(columnKey);
    const columnContacts = grouped[columnKey] || [];
    const isDropTarget = canManagePipeline && draggedContactId && dropColumnKey === columnKey;
    const recentEntriesCount = columnContacts.filter(contact => getContactSpotlight(contact, spotlightConfig).isRecentEntry).length;
    const newCustomersCount = columnContacts.filter(contact => getContactSpotlight(contact, spotlightConfig).isNewCustomer).length;
    const currentIndex = desktopColumnIndexes[columnKey] || 0;
    const currentContact = columnContacts[currentIndex] || null;
    const canGoPrev = currentIndex > 0;
    const canGoNext = currentIndex < columnContacts.length - 1;

    return (
      <article
        key={columnKey}
        onDragOver={event => handleDragOver(event, columnKey)}
        onDrop={event => handleDrop(event, columnKey)}
        onDragLeave={() => {
          if (dropColumnKey === columnKey) {
            setDropColumnKey('');
          }
        }}
        className={`rounded-3xl border p-4 shadow-sm transition ${statusMeta.cardClassName} ${
          isDropTarget ? 'ring-2 ring-brand/50 ring-offset-2 ring-offset-surface-50' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
              {statusMeta.label}
            </span>
            <p className="mt-3 text-sm text-slate-500">
              {columnContacts.length
                ? `${columnContacts.length} contacto${columnContacts.length === 1 ? '' : 's'} en esta etapa.`
                : 'Sin contactos en esta etapa.'}
            </p>
            {(recentEntriesCount > 0 || newCustomersCount > 0) ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {recentEntriesCount > 0 ? (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                    {recentEntriesCount} nueva{recentEntriesCount === 1 ? '' : 's'}
                  </span>
                ) : null}
                {newCustomersCount > 0 ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    {newCustomersCount} cliente{newCustomersCount === 1 ? '' : 's'} nuevo{newCustomersCount === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
            ) : null}
            {isDropTarget ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-brand">
                Suelta aqui para mover
              </p>
            ) : null}
          </div>
          <span className="rounded-2xl bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-surface-200">
            {columnContacts.length}
          </span>
        </div>

        <div className="mt-4">
          {currentContact ? (
            <div className="min-h-[292px]">
              {renderContactCard(currentContact)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-surface-200 bg-white/80 px-4 py-6 text-sm text-slate-400">
              No hay contactos en esta etapa.
            </div>
          )}
        </div>

        {columnContacts.length > 1 ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  canGoPrev &&
                  setDesktopColumnIndexes(previous => ({
                    ...previous,
                    [columnKey]: Math.max((previous[columnKey] || 0) - 1, 0)
                  }))
                }
                disabled={!canGoPrev}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  canGoPrev
                    ? 'bg-white text-slate-900 ring-1 ring-inset ring-surface-200'
                    : 'cursor-not-allowed bg-white/60 text-slate-400 ring-1 ring-inset ring-surface-200'
                }`}
              >
                Anterior
              </button>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {currentIndex + 1} / {columnContacts.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  canGoNext &&
                  setDesktopColumnIndexes(previous => ({
                    ...previous,
                    [columnKey]: Math.min((previous[columnKey] || 0) + 1, columnContacts.length - 1)
                  }))
                }
                disabled={!canGoNext}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  canGoNext
                    ? 'bg-slate-950 text-white'
                    : 'cursor-not-allowed bg-slate-300 text-white/80'
                }`}
              >
                Siguiente
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-hidden">
              {columnContacts.slice(0, 8).map((contact, index) => (
                <button
                  key={contact._id}
                  type="button"
                  onClick={() =>
                    setDesktopColumnIndexes(previous => ({
                      ...previous,
                      [columnKey]: index
                    }))
                  }
                  className={`h-1.5 rounded-full transition ${
                    index === currentIndex ? 'w-10 bg-slate-950' : 'w-5 bg-slate-300'
                  }`}
                  aria-label={`Ver contacto ${index + 1} en ${statusMeta.label}`}
                />
              ))}
              {columnContacts.length > 8 ? (
                <span className="ml-1 text-[11px] font-semibold text-slate-400">
                  +{columnContacts.length - 8}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </article>
    );
  };

  const renderMobileColumn = columnKey => {
    const statusMeta = getCRMStatusMeta(columnKey);
    const columnContacts = grouped[columnKey] || [];
    const currentContact = columnContacts[selectedMobileCardIndex] || null;
    const canGoPrev = selectedMobileCardIndex > 0;
    const canGoNext = selectedMobileCardIndex < columnContacts.length - 1;
    const recentEntriesCount = columnContacts.filter(contact => getContactSpotlight(contact, spotlightConfig).isRecentEntry).length;
    const newCustomersCount = columnContacts.filter(contact => getContactSpotlight(contact, spotlightConfig).isNewCustomer).length;

    return (
      <article
        className={`rounded-3xl border p-4 shadow-sm transition ${statusMeta.cardClassName}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
              {statusMeta.label}
            </span>
            <p className="mt-3 text-sm text-slate-500">
              {columnContacts.length
                ? `${columnContacts.length} contacto${columnContacts.length === 1 ? '' : 's'} en esta etapa.`
                : 'Sin contactos en esta etapa.'}
            </p>
            {(recentEntriesCount > 0 || newCustomersCount > 0) ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {recentEntriesCount > 0 ? (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                    {recentEntriesCount} entrada{recentEntriesCount === 1 ? '' : 's'} nueva{recentEntriesCount === 1 ? '' : 's'}
                  </span>
                ) : null}
                {newCustomersCount > 0 ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    {newCustomersCount} cliente{newCustomersCount === 1 ? '' : 's'} nuevo{newCustomersCount === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-2xl bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-surface-200">
              {columnContacts.length}
            </span>
            {columnContacts.length > 0 ? (
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {selectedMobileCardIndex + 1} / {columnContacts.length}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          {currentContact ? (
            <div className="min-h-[292px]">
              {renderContactCard(currentContact)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-surface-200 bg-white/80 px-4 py-8 text-sm text-slate-400">
              No hay contactos en esta etapa.
            </div>
          )}
        </div>

        {columnContacts.length > 1 ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => canGoPrev && setSelectedMobileCardIndex(index => index - 1)}
                disabled={!canGoPrev}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  canGoPrev
                    ? 'bg-white text-slate-900 ring-1 ring-inset ring-surface-200'
                    : 'cursor-not-allowed bg-white/60 text-slate-400 ring-1 ring-inset ring-surface-200'
                }`}
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => canGoNext && setSelectedMobileCardIndex(index => index + 1)}
                disabled={!canGoNext}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  canGoNext
                    ? 'bg-slate-950 text-white'
                    : 'cursor-not-allowed bg-slate-300 text-white/80'
                }`}
              >
                Siguiente
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-hidden">
              {columnContacts.slice(0, 10).map((contact, index) => (
                <button
                  key={contact._id}
                  type="button"
                  onClick={() => setSelectedMobileCardIndex(index)}
                  className={`h-1.5 rounded-full transition ${
                    index === selectedMobileCardIndex
                      ? 'w-10 bg-slate-950'
                      : 'w-5 bg-slate-300'
                  }`}
                  aria-label={`Ver contacto ${index + 1}`}
                />
              ))}
              {columnContacts.length > 10 ? (
                <span className="ml-1 text-[11px] font-semibold text-slate-400">
                  +{columnContacts.length - 10}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <CRMSectionNav />

        <header className="overflow-hidden rounded-[2rem] bg-white p-6 shadow-brand-sm">
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr] xl:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CRM</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">Pipeline comercial</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Vista operativa para mover oportunidades entre etapas, detectar bloqueos y ejecutar la siguiente accion correcta.
              </p>
              {canManagePipeline ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                  <HiOutlineArrowsUpDown className="text-sm" />
                  Drag and drop activo
                </div>
              ) : canEditContacts ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
                  Cambio manual de etapa
                </div>
              ) : (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 ring-1 ring-inset ring-amber-200">
                  Solo lectura
                </div>
              )}
            </div>
            <div className="grid gap-3 rounded-3xl border border-surface-200 bg-slate-50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">En pipeline</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{pipelineSummary.total}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Calientes</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{pipelineSummary.hot}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Con siguiente tarea</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{pipelineSummary.withTask}</p>
              </div>
            </div>
          </div>
        </header>

        {(actionMessage || error) && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              error
                ? 'border border-red-200 bg-red-50 text-red-700'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {error || actionMessage}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[0.7fr_0.7fr_1fr]">
          <article className="rounded-3xl border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,1),rgba(255,247,237,1))] p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-700">Radar</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{spotlightSummary.recentEntries}</p>
            <p className="mt-2 text-sm text-slate-600">Entradas nuevas detectadas en etapas accionables.</p>
          </article>
          <article className="rounded-3xl border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(240,253,250,1))] p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700">Conversion</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{spotlightSummary.newCustomers}</p>
            <p className="mt-2 text-sm text-slate-600">Clientes nuevos que acaban de entrar a compra.</p>
          </article>
          <article className="rounded-3xl border border-surface-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {COLUMN_ORDER.map(columnKey => {
                const statusMeta = getCRMStatusMeta(columnKey);
                const recentEntriesCount = (grouped[columnKey] || []).filter(contact => getContactSpotlight(contact, spotlightConfig).isRecentEntry).length;
                const newCustomersCount = (grouped[columnKey] || []).filter(contact => getContactSpotlight(contact, spotlightConfig).isNewCustomer).length;
                if (!recentEntriesCount && !newCustomersCount) {
                  return null;
                }

                return (
                  <div key={`spotlight-${columnKey}`} className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-inset ring-surface-200">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{statusMeta.label}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                      {recentEntriesCount ? (
                        <span className="text-amber-700">{recentEntriesCount} nuevas</span>
                      ) : null}
                      {newCustomersCount ? (
                        <span className="text-emerald-700">{newCustomersCount} clientes</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className="space-y-4 md:hidden">
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              {COLUMN_ORDER.map(columnKey => {
                const statusMeta = getCRMStatusMeta(columnKey);
                const count = (grouped[columnKey] || []).length;
                const isActive = selectedMobileColumn === columnKey;
                const spotlightCounts = (grouped[columnKey] || []).reduce(
                  (acc, contact) => {
                    const spotlight = getContactSpotlight(contact, spotlightConfig);
                    if (spotlight.isRecentEntry) acc.recentEntries += 1;
                    if (spotlight.isNewCustomer) acc.newCustomers += 1;
                    return acc;
                  },
                  { recentEntries: 0, newCustomers: 0 }
                );

                return (
                  <button
                    key={columnKey}
                    type="button"
                    onClick={() => setSelectedMobileColumn(columnKey)}
                    className={`rounded-full border px-4 py-2 text-left transition ${
                      isActive
                        ? 'border-slate-950 bg-slate-950 text-white shadow-sm'
                        : 'border-surface-200 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isActive ? 'bg-white/15 text-white' : statusMeta.badgeClassName}`}>
                        {statusMeta.label}
                      </span>
                      <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-700'}`}>
                        {count}
                      </span>
                    </div>
                    {(spotlightCounts.recentEntries > 0 || spotlightCounts.newCustomers > 0) ? (
                      <div className={`mt-1 flex flex-wrap gap-1 text-[10px] font-semibold ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                        {spotlightCounts.recentEntries > 0 ? <span>Nuevas {spotlightCounts.recentEntries}</span> : null}
                        {spotlightCounts.newCustomers > 0 ? <span>Clientes {spotlightCounts.newCustomers}</span> : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {renderMobileColumn(selectedMobileColumn)}
        </section>

        <section className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-3 2xl:grid-cols-4">
          {COLUMN_ORDER.map(renderColumn)}
        </section>
      </div>
    </div>
  );
};

export default CRMPipelinePage;
