import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineBookmarkSquare,
  HiOutlineCheckCircle,
  HiOutlineIdentification,
  HiOutlineMagnifyingGlass,
  HiOutlineSparkles,
  HiOutlineUsers
} from 'react-icons/hi2';
import { bulkUpdateCRMContacts, getCRMContacts, linkCRMWhatsAppLead } from '../../api/crm';
import CRMSectionNav from '../../components/crm/CRMSectionNav';
import {
  formatCRMDateTime,
  formatCRMCurrency,
  getActionableContactCount,
  getContactPrimaryChannel,
  getContactSecondaryChannel,
  getCRMSourceLabel,
  getCRMStatusMeta,
  getContactValueTier
} from '../../components/crm/crmUi';

const SAVED_VIEWS_KEY = 'runacommerce.crm.savedViews';

const EMPTY_FILTERS = {
  q: '',
  status: '',
  tag: '',
  ownerId: '',
  missingNextAction: false,
  onlyActionable: false
};

const emptyBulkForm = {
  status: '',
  ownerId: '',
  addTag: '',
  markContacted: false
};

const readSavedViews = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeSavedViews = views => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
};

const CRMContactsPage = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [contacts, setContacts] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [linkingLead, setLinkingLead] = useState(false);
  const [linkLeadError, setLinkLeadError] = useState('');
  const [linkLeadMessage, setLinkLeadMessage] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [savedViews, setSavedViews] = useState(() => readSavedViews());
  const [savedViewName, setSavedViewName] = useState('');
  const [bulkForm, setBulkForm] = useState(emptyBulkForm);
  const [leadLinkForm, setLeadLinkForm] = useState({
    leadCode: '',
    name: '',
    phone: '',
    whatsapp: '',
    note: ''
  });

  const loadContacts = async currentFilters => {
    try {
      const data = await getCRMContacts(currentFilters);
      setContacts(data.contacts || []);
      setStatuses(data.statuses || []);
      setOwners(data.owners || []);
      setError('');
      setSelectedIds([]);
    } catch {
      setError('No se pudo cargar la base de contactos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts(EMPTY_FILTERS);
  }, []);

  const handleChange = event => {
    const { name, value, type, checked } = event.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = event => {
    event.preventDefault();
    setLoading(true);
    loadContacts(filters);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setLoading(true);
    loadContacts(EMPTY_FILTERS);
  };

  const handleLeadLinkChange = event => {
    const { name, value } = event.target;
    setLeadLinkForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLeadLinkSubmit = async event => {
    event.preventDefault();
    setLinkingLead(true);
    setLinkLeadError('');
    setLinkLeadMessage('');

    try {
      const contact = await linkCRMWhatsAppLead(leadLinkForm);
      setLinkLeadMessage(`Lead ${contact.leadCode || leadLinkForm.leadCode} vinculado correctamente.`);
      setLeadLinkForm({
        leadCode: '',
        name: '',
        phone: '',
        whatsapp: '',
        note: ''
      });
      loadContacts(filters);
    } catch (requestError) {
      setLinkLeadError(requestError?.response?.data?.message || 'No se pudo vincular el lead de WhatsApp.');
    } finally {
      setLinkingLead(false);
    }
  };

  const handleSaveView = () => {
    const name = savedViewName.trim();
    if (!name) {
      return;
    }

    const nextViews = [
      ...savedViews.filter(view => view.name !== name),
      {
        name,
        filters
      }
    ];
    setSavedViews(nextViews);
    writeSavedViews(nextViews);
    setSavedViewName('');
  };

  const handleDeleteView = name => {
    const nextViews = savedViews.filter(view => view.name !== name);
    setSavedViews(nextViews);
    writeSavedViews(nextViews);
  };

  const handleApplyView = view => {
    setFilters(view.filters);
    setLoading(true);
    loadContacts(view.filters);
  };

  const handleToggleSelection = contactId => {
    setSelectedIds(prev =>
      prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );
  };

  const handleSelectAllVisible = checked => {
    setSelectedIds(checked ? contacts.map(contact => contact._id) : []);
  };

  const handleBulkChange = event => {
    const { name, value, type, checked } = event.target;
    setBulkForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleBulkSubmit = async event => {
    event.preventDefault();
    if (!selectedIds.length) {
      setBulkError('Selecciona al menos un contacto.');
      setBulkMessage('');
      return;
    }

    const payload = {
      contactIds: selectedIds
    };

    if (bulkForm.status) {
      payload.status = bulkForm.status;
    }
    if (bulkForm.ownerId) {
      payload.ownerId = bulkForm.ownerId;
    }
    if (bulkForm.addTag.trim()) {
      payload.addTag = bulkForm.addTag.trim();
    }
    if (bulkForm.markContacted) {
      payload.markContacted = true;
    }

    setBulkSaving(true);
    setBulkError('');
    setBulkMessage('');

    try {
      const result = await bulkUpdateCRMContacts(payload);
      setBulkMessage(`${result.updatedCount || selectedIds.length} contactos actualizados.`);
      setBulkForm(emptyBulkForm);
      await loadContacts(filters);
    } catch (requestError) {
      setBulkError(requestError?.response?.data?.message || 'No se pudo ejecutar la accion masiva.');
    } finally {
      setBulkSaving(false);
    }
  };

  const summary = useMemo(() => {
    const actionable = getActionableContactCount(contacts);
    const identified = contacts.filter(contact => contact.phone || contact.whatsapp || contact.email).length;
    const withReference = contacts.filter(contact => contact.leadCode).length;
    const customerValue = contacts.reduce((acc, contact) => acc + Number(contact.totalSpent || 0), 0);
    const missingNextAction = contacts.filter(contact => contact.nextActionRequired).length;
    const assigned = contacts.filter(contact => contact.owner?._id).length;
    return {
      total: contacts.length,
      actionable,
      identified,
      withReference,
      customerValue,
      missingNextAction,
      assigned
    };
  }, [contacts]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando contactos...</div>;
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <CRMSectionNav />

        <header className="overflow-hidden rounded-[2rem] bg-white p-6 shadow-brand-sm">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CRM</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">Contactos</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Base comercial unificada para leads, compradores y contactos recuperables desde WhatsApp, checkout y navegacion.
              </p>
            </div>
            <div className="grid gap-3 rounded-3xl border border-surface-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Accionables</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.actionable}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Sin siguiente accion</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.missingNextAction}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Asignados</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.assigned}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Valor acumulado</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCRMCurrency(summary.customerValue)}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <HiOutlineMagnifyingGlass className="text-2xl" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Buscar y priorizar</h2>
                <p className="text-sm text-slate-500">Aplica filtros operativos para trabajar tu cola comercial.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <label className="text-sm text-slate-600 md:col-span-2">
                Buscar
                <input
                  type="search"
                  name="q"
                  value={filters.q}
                  onChange={handleChange}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                  placeholder="Nombre, telefono, email o referencia"
                />
              </label>
              <label className="text-sm text-slate-600">
                Estado
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleChange}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                >
                  <option value="">Todos</option>
                  {statuses.map(option => (
                    <option key={option.value} value={option.value}>
                      {getCRMStatusMeta(option.value).label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Tag
                <input
                  type="text"
                  name="tag"
                  value={filters.tag}
                  onChange={handleChange}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                  placeholder="vip, cart_abandoned..."
                />
              </label>
              <label className="text-sm text-slate-600">
                Propietario
                <select
                  name="ownerId"
                  value={filters.ownerId}
                  onChange={handleChange}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                >
                  <option value="">Todos</option>
                  {owners.map(owner => (
                    <option key={owner._id} value={owner._id}>
                      {owner.name || owner.email}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="onlyActionable"
                    checked={filters.onlyActionable}
                    onChange={handleChange}
                  />
                  Solo contactos que requieren accion
                </label>
                <label className="inline-flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="missingNextAction"
                    checked={filters.missingNextAction}
                    onChange={handleChange}
                  />
                  Sin siguiente accion
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="rounded-2xl border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand/30 hover:text-brand"
                >
                  Limpiar
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Filtrar base
                </button>
              </div>
            </div>
          </form>

          <form onSubmit={handleLeadLinkSubmit} className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <HiOutlineIdentification className="text-2xl" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Vincular chat de WhatsApp</h2>
                <p className="text-sm text-slate-500">Convierte el lead anonimo en ficha identificada usando la referencia.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-600 md:col-span-2">
                Referencia
                <input
                  type="text"
                  name="leadCode"
                  value={leadLinkForm.leadCode}
                  onChange={handleLeadLinkChange}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5 uppercase"
                  placeholder="RC-AB12CD"
                  required
                />
              </label>
              <label className="text-sm text-slate-600">
                Nombre
                <input
                  type="text"
                  name="name"
                  value={leadLinkForm.name}
                  onChange={handleLeadLinkChange}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                  placeholder="Nombre del cliente"
                />
              </label>
              <label className="text-sm text-slate-600">
                Telefono
                <input
                  type="text"
                  name="phone"
                  value={leadLinkForm.phone}
                  onChange={handleLeadLinkChange}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                  placeholder="098..."
                />
              </label>
              <label className="text-sm text-slate-600">
                WhatsApp
                <input
                  type="text"
                  name="whatsapp"
                  value={leadLinkForm.whatsapp}
                  onChange={handleLeadLinkChange}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                  placeholder="593..."
                />
              </label>
              <label className="text-sm text-slate-600">
                Nota
                <input
                  type="text"
                  name="note"
                  value={leadLinkForm.note}
                  onChange={handleLeadLinkChange}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                  placeholder="Ej: escribio desde catalogo"
                />
              </label>
            </div>
            {(linkLeadError || linkLeadMessage) && (
              <p className={`mt-4 text-sm ${linkLeadError ? 'text-red-600' : 'text-emerald-600'}`}>
                {linkLeadError || linkLeadMessage}
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={linkingLead}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {linkingLead ? 'Vinculando...' : 'Vincular lead'}
              </button>
            </div>
          </form>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <HiOutlineBookmarkSquare className="text-2xl" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Vistas guardadas</h2>
                <p className="text-sm text-slate-500">Guarda filtros operativos para volver rapido a la misma cola.</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <input
                type="text"
                value={savedViewName}
                onChange={event => setSavedViewName(event.target.value)}
                className="flex-1 rounded-2xl border border-surface-200 px-3 py-2.5"
                placeholder="Ej: Leads sin seguimiento"
              />
              <button
                type="button"
                onClick={handleSaveView}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Guardar
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {savedViews.length ? (
                savedViews.map(view => (
                  <div key={view.name} className="flex items-center justify-between gap-3 rounded-2xl border border-surface-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleApplyView(view)}
                      className="text-left text-sm font-semibold text-slate-800 hover:text-brand"
                    >
                      {view.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteView(view.name)}
                      className="text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-red-600"
                    >
                      borrar
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-slate-500">
                  Todavia no has guardado vistas.
                </div>
              )}
            </div>
          </article>

          <form onSubmit={handleBulkSubmit} className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <HiOutlineCheckCircle className="text-2xl" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Acciones masivas</h2>
                <p className="text-sm text-slate-500">Asigna propietario, cambia estado o marca seguimiento sobre la seleccion actual.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <label className="text-sm text-slate-600">
                Estado
                <select
                  name="status"
                  value={bulkForm.status}
                  onChange={handleBulkChange}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                >
                  <option value="">Sin cambio</option>
                  {statuses.map(option => (
                    <option key={option.value} value={option.value}>
                      {getCRMStatusMeta(option.value).label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Propietario
                <select
                  name="ownerId"
                  value={bulkForm.ownerId}
                  onChange={handleBulkChange}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                >
                  <option value="">Sin cambio</option>
                  {owners.map(owner => (
                    <option key={owner._id} value={owner._id}>
                      {owner.name || owner.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Agregar tag
                <input
                  type="text"
                  name="addTag"
                  value={bulkForm.addTag}
                  onChange={handleBulkChange}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                  placeholder="Ej: followup"
                />
              </label>
              <label className="mt-7 inline-flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="markContacted"
                  checked={bulkForm.markContacted}
                  onChange={handleBulkChange}
                />
                Marcar contactados
              </label>
            </div>
            {(bulkError || bulkMessage) && (
              <p className={`mt-4 text-sm ${bulkError ? 'text-red-600' : 'text-emerald-600'}`}>
                {bulkError || bulkMessage}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">{selectedIds.length} seleccionados</p>
              <button
                type="submit"
                disabled={bulkSaving}
                className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkSaving ? 'Aplicando...' : 'Aplicar accion'}
              </button>
            </div>
          </form>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <HiOutlineUsers className="text-2xl" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Base total</p>
                <p className="mt-1 text-3xl font-semibold text-slate-950">{summary.total}</p>
              </div>
            </div>
          </article>
          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <HiOutlineSparkles className="text-2xl" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Listos para actuar</p>
                <p className="mt-1 text-3xl font-semibold text-slate-950">{summary.actionable}</p>
              </div>
            </div>
          </article>
          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Identificados</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.identified}</p>
            <p className="mt-2 text-sm text-slate-500">Contactos con telefono, WhatsApp o email validos.</p>
          </article>
          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Con referencia</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.withReference}</p>
            <p className="mt-2 text-sm text-slate-500">Listos para vincular desde WhatsApp.</p>
          </article>
        </section>

        <section className="grid gap-4 lg:hidden">
          {contacts.length ? (
            contacts.map(contact => {
              const statusMeta = getCRMStatusMeta(contact.status);
              const isSelected = selectedIds.includes(contact._id);
              return (
                <article key={contact._id} className={`rounded-3xl border p-5 shadow-sm ${statusMeta.cardClassName}`}>
                  <div className="flex items-start justify-between gap-3">
                    <label className="inline-flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelection(contact._id)}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-lg font-semibold text-slate-950">{contact.name || 'Sin nombre'}</p>
                        <p className="mt-1 text-sm text-slate-600">{getContactPrimaryChannel(contact)}</p>
                      </div>
                    </label>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Origen</p>
                      <p className="mt-1 text-sm text-slate-700">{getContactSecondaryChannel(contact)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Propietario</p>
                      <p className="mt-1 text-sm text-slate-700">{contact.owner?.name || 'Sin asignar'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Valor</p>
                      <p className="mt-1 text-sm text-slate-700">
                        {formatCRMCurrency(contact.totalSpent)} · {getContactValueTier(contact)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Ultima actividad</p>
                      <p className="mt-1 text-sm text-slate-700">{formatCRMDateTime(contact.lastSeenAt)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {contact.nextActionRequired ? (
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-200">
                        Falta siguiente accion
                      </span>
                    ) : null}
                    {contact.leadCode ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        {contact.leadCode}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-surface-200">
                      {getCRMSourceLabel(contact.source)}
                    </span>
                    <Link to={`/crm/contactos/${contact._id}`} className="text-sm font-semibold text-brand hover:text-brand-dark">
                      Ver ficha
                    </Link>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-3xl border border-surface-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              No hay contactos para los filtros actuales.
            </div>
          )}
        </section>

        <section className="hidden rounded-3xl border border-surface-200 bg-white p-5 shadow-sm lg:block">
          <div className="mb-4 flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={contacts.length > 0 && selectedIds.length === contacts.length}
                onChange={event => handleSelectAllVisible(event.target.checked)}
              />
              Seleccionar visibles
            </label>
            <p className="text-sm text-slate-500">{selectedIds.length} seleccionados</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-200">
              <thead className="bg-surface-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3"></th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Ultima actividad</th>
                  <th className="px-4 py-3 text-right">Abrir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 text-sm text-slate-700">
                {contacts.length ? (
                  contacts.map(contact => {
                    const statusMeta = getCRMStatusMeta(contact.status);
                    return (
                      <tr key={contact._id} className="transition hover:bg-surface-50">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(contact._id)}
                            onChange={() => handleToggleSelection(contact._id)}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950">{contact.name || 'Sin nombre'}</p>
                          <p className="text-slate-500">{getContactPrimaryChannel(contact)}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {contact.leadCode ? (
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 ring-1 ring-inset ring-emerald-200">
                                Ref: {contact.leadCode}
                              </span>
                            ) : null}
                            {contact.nextActionRequired ? (
                              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-200">
                                Falta siguiente accion
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {contact.owner?.name || <span className="text-slate-400">Sin asignar</span>}
                        </td>
                        <td className="px-4 py-4">
                          <p>{getCRMSourceLabel(contact.source)}</p>
                          <p className="text-xs text-slate-500">{contact.medium || 'organico'}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p>{getContactValueTier(contact)}</p>
                          <p className="text-xs text-slate-500">
                            {contact.ordersCount || 0} pedidos · {formatCRMCurrency(contact.totalSpent)}
                          </p>
                        </td>
                        <td className="px-4 py-4">{formatCRMDateTime(contact.lastSeenAt)}</td>
                        <td className="px-4 py-4 text-right">
                          <Link to={`/crm/contactos/${contact._id}`} className="font-semibold text-brand hover:text-brand-dark">
                            Ver ficha
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                      No hay contactos para los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CRMContactsPage;
