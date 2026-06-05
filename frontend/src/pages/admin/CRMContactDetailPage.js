import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineClock,
  HiOutlineCurrencyDollar,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineShoppingBag,
  HiOutlineSparkles
} from 'react-icons/hi2';
import { createCRMNote, createCRMTask, getCRMContactDetail, linkCRMWhatsAppLead, updateCRMContact } from '../../api/crm';
import CRMSectionNav from '../../components/crm/CRMSectionNav';
import {
  formatCRMDate,
  formatCRMDateTime,
  formatCRMCurrency,
  getCartStatusMeta,
  getCRMEventMeta,
  getCRMStatusMeta,
  getCRMTaskPriorityMeta,
  getCRMTaskStatusMeta
} from '../../components/crm/crmUi';

const formatMessageTitle = key =>
  key
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const CRMContactDetailPage = () => {
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [note, setNote] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [owners, setOwners] = useState([]);
  const [linkForm, setLinkForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    note: ''
  });

  const loadDetail = useCallback(async () => {
    try {
      const data = await getCRMContactDetail(id);
      setDetail(data);
      setOwnerId(data?.contact?.owner?._id || '');
      setOwners(data?.owners || []);
      setLinkForm({
        name: data?.contact?.name || '',
        phone: data?.contact?.phone || '',
        whatsapp: data?.contact?.whatsapp || data?.contact?.phone || '',
        note: ''
      });
      setError('');
    } catch {
      setError('No se pudo cargar la ficha del contacto.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleContactUpdate = async payload => {
    setSaving(true);
    try {
      await updateCRMContact(id, payload);
      await loadDetail();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNote = async event => {
    event.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      await createCRMNote(id, note.trim());
      setNote('');
      await loadDetail();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async event => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    setSaving(true);
    try {
      await createCRMTask({
        contact: id,
        contactName: detail?.contact?.name || '',
        title: taskTitle.trim(),
        description: `Seguimiento manual para ${detail?.contact?.name || 'contacto'}.`,
        type: 'follow_up',
        priority: 'medium',
        dueDate: taskDueDate || null
      });
      setTaskTitle('');
      setTaskDueDate('');
      await loadDetail();
    } finally {
      setSaving(false);
    }
  };

  const handleLinkChange = event => {
    const { name, value } = event.target;
    setLinkForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLinkWhatsApp = async event => {
    event.preventDefault();
    if (!detail?.contact?.leadCode) return;
    setSaving(true);
    try {
      await linkCRMWhatsAppLead({
        leadCode: detail.contact.leadCode,
        name: linkForm.name,
        phone: linkForm.phone,
        whatsapp: linkForm.whatsapp,
        note: linkForm.note
      });
      await loadDetail();
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLeadCode = async () => {
    if (!detail?.contact?.leadCode || !navigator?.clipboard?.writeText) return;
    await navigator.clipboard.writeText(detail.contact.leadCode);
    setCopyMessage('Referencia copiada.');
    window.setTimeout(() => setCopyMessage(''), 1800);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando ficha...</div>;
  }

  if (error || !detail) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error || 'Contacto no encontrado'}</div>;
  }

  const { contact, events = [], tasks = [], notes = [], orders = [], carts = [], suggestedMessages = {}, viewedProducts = [] } = detail;
  const statusMeta = getCRMStatusMeta(contact.status);
  const pendingTasks = tasks.filter(task => task.status === 'pending' || task.status === 'overdue');
  const latestTask = pendingTasks[0] || null;
  const visibleEvents = showAllEvents ? events : events.slice(0, 6);

  const summaryCards = [
    {
      label: 'Estado',
      value: statusMeta.label,
      helper: contact.lastContactedAt ? `Ultimo contacto ${formatCRMDate(contact.lastContactedAt)}` : 'Sin contacto manual aun.',
      icon: HiOutlineSparkles
    },
    {
      label: 'Pedidos',
      value: String(contact.ordersCount || 0),
      helper: orders[0]?.orderNumber ? `Ultimo pedido #${orders[0].orderNumber}` : 'Sin ordenes ligadas.',
      icon: HiOutlineShoppingBag
    },
    {
      label: 'Gasto acumulado',
      value: formatCRMCurrency(contact.totalSpent),
      helper: contact.lastPurchasedAt ? `Ultima compra ${formatCRMDate(contact.lastPurchasedAt)}` : 'Sin conversion registrada.',
      icon: HiOutlineCurrencyDollar
    },
    {
      label: 'Proxima accion',
      value: latestTask?.title || 'Sin tarea',
      helper: latestTask?.dueDate ? `Vence ${formatCRMDateTime(latestTask.dueDate)}` : 'Define el siguiente paso.',
      icon: HiOutlineClock
    }
  ];

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <CRMSectionNav
          extraItem={{
            to: `/crm/contactos/${id}`,
            label: 'Ficha',
            matchPrefix: `/crm/contactos/${id}`
          }}
        />

        <header className="overflow-hidden rounded-[2rem] bg-white p-6 shadow-brand-sm">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CRM</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
                  {statusMeta.label}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950">{contact.name || 'Sin nombre'}</h1>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <HiOutlinePhone className="text-lg text-slate-400" />
                    <span>{contact.phone || contact.whatsapp || 'Sin telefono registrado'}</span>
                  </div>
                  {contact.whatsapp && contact.whatsapp !== contact.phone ? (
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <HiOutlineChatBubbleLeftRight className="text-lg text-slate-400" />
                      <span>{contact.whatsapp}</span>
                    </div>
                  ) : null}
                  {contact.email ? (
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <HiOutlineEnvelope className="text-lg text-slate-400" />
                      <span>{contact.email}</span>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/50">Referencia WhatsApp</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold uppercase tracking-[0.2em]">
                      {contact.leadCode || 'Sin referencia'}
                    </p>
                    {contact.leadCode ? (
                      <button
                        type="button"
                        onClick={handleCopyLeadCode}
                        className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                      >
                        Copiar
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-white/60">
                    {copyMessage || 'Usa esta referencia para vincular el chat real cuando escriba el cliente.'}
                  </p>
                </div>
              </div>
              {contact.nextActionRequired ? (
                <div className="mt-4 inline-flex rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 ring-1 ring-inset ring-orange-200">
                  Este contacto requiere siguiente accion: aun no tiene tarea abierta.
                </div>
              ) : null}
            </div>

            <div className="space-y-3 rounded-3xl border border-surface-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Acciones rapidas</p>
              <div className="rounded-2xl bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Propietario</p>
                <div className="mt-2 flex gap-2">
                  <select
                    value={ownerId}
                    onChange={event => setOwnerId(event.target.value)}
                    className="flex-1 rounded-2xl border border-surface-200 px-3 py-2 text-sm"
                  >
                    <option value="">Sin asignar</option>
                    {owners.map(owner => (
                      <option key={owner._id} value={owner._id}>
                        {owner.name || owner.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleContactUpdate({ ownerId })}
                    className="rounded-2xl border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand/30 hover:text-brand"
                  >
                    Guardar
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleContactUpdate({ markContacted: true, status: 'contacted' })}
                  className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand/30 hover:text-brand"
                >
                  Marcar contactado
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleContactUpdate({ status: 'customer' })}
                  className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Convertir a cliente
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleContactUpdate({ status: 'interested' })}
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Marcar interesado
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleContactUpdate({ status: 'lost' })}
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Marcar perdido
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(card => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{card.label}</p>
                    <strong className="mt-2 block text-2xl font-semibold text-slate-950">{card.value}</strong>
                  </div>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Icon className="text-2xl" />
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">{card.helper}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Actividad</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">Timeline comercial</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {events.length} eventos
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {events.length ? (
                visibleEvents.map(event => {
                  const eventMeta = getCRMEventMeta(event.eventType);
                  return (
                    <div key={event._id} className="rounded-2xl border border-surface-200 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className={`font-semibold ${eventMeta.toneClassName}`}>{eventMeta.label}</p>
                          <p className="mt-1 text-xs text-slate-400">{formatCRMDateTime(event.createdAt)}</p>
                        </div>
                        {event.product?.name ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {event.product.name}
                          </span>
                        ) : null}
                      </div>
                      {event.order?.orderNumber ? (
                        <p className="mt-3 text-sm text-slate-600">Pedido relacionado: #{event.order.orderNumber}</p>
                      ) : null}
                      {event.metadata?.note ? (
                        <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{event.metadata.note}</p>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-slate-500">
                  Sin eventos todavia.
                </p>
              )}
              {events.length > 6 ? (
                <button
                  type="button"
                  onClick={() => setShowAllEvents(prev => !prev)}
                  className="inline-flex rounded-2xl border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand/30 hover:text-brand"
                >
                  {showAllEvents ? 'Ver menos eventos' : `Ver ${events.length - 6} eventos mas`}
                </button>
              ) : null}
            </div>
          </article>

          <div className="space-y-6">
            <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Mensajes sugeridos</h2>
              <div className="mt-4 space-y-3">
                {Object.entries(suggestedMessages).map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-surface-200 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{formatMessageTitle(key)}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {value || 'Sin sugerencia disponible'}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Nueva tarea</h2>
              <form onSubmit={handleCreateTask} className="mt-4 space-y-3">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={event => setTaskTitle(event.target.value)}
                  className="w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                  placeholder="Ej: Enviar link de producto"
                />
                <input
                  type="datetime-local"
                  value={taskDueDate}
                  onChange={event => setTaskDueDate(event.target.value)}
                  className="w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Crear tarea
                </button>
              </form>
            </article>

            {contact.leadCode ? (
              <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">Vincular chat de WhatsApp</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Cuando el cliente responda, registra su numero real usando la referencia enviada.
                </p>
                <form onSubmit={handleLinkWhatsApp} className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={contact.leadCode}
                    readOnly
                    className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-emerald-700"
                  />
                  <input
                    type="text"
                    name="name"
                    value={linkForm.name}
                    onChange={handleLinkChange}
                    className="w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                    placeholder="Nombre del cliente"
                  />
                  <input
                    type="text"
                    name="phone"
                    value={linkForm.phone}
                    onChange={handleLinkChange}
                    className="w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                    placeholder="Telefono"
                  />
                  <input
                    type="text"
                    name="whatsapp"
                    value={linkForm.whatsapp}
                    onChange={handleLinkChange}
                    className="w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                    placeholder="WhatsApp"
                  />
                  <textarea
                    name="note"
                    value={linkForm.note}
                    onChange={handleLinkChange}
                    rows={3}
                    className="w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                    placeholder="Nota del primer contacto"
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    Vincular numero al lead
                  </button>
                </form>
              </article>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Notas internas</h2>
            <form onSubmit={handleSaveNote} className="mt-4 space-y-3">
              <textarea
                value={note}
                onChange={event => setNote(event.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                placeholder="Registrar contexto comercial, objeciones o siguiente paso"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand/30 hover:text-brand"
              >
                Guardar nota
              </button>
            </form>
            <div className="mt-4 space-y-3">
              {notes.length ? (
                notes.map(item => (
                  <div key={item._id} className="rounded-2xl border border-surface-200 px-4 py-4">
                    <p className="text-sm leading-6 text-slate-700">{item.note}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {item.admin?.name || 'Admin'} · {formatCRMDateTime(item.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-slate-500">
                  Sin notas registradas.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Tareas, ordenes y carritos</h2>
            <div className="mt-4 space-y-3">
              {tasks.map(task => {
                const taskStatusMeta = getCRMTaskStatusMeta(task.status);
                const priorityMeta = getCRMTaskPriorityMeta(task.priority);
                return (
                  <div key={task._id} className="rounded-2xl border border-surface-200 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{task.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{task.description || 'Sin descripcion'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${taskStatusMeta.badgeClassName}`}>
                          {taskStatusMeta.label}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityMeta.badgeClassName}`}>
                          {priorityMeta.label}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">Vence: {formatCRMDateTime(task.dueDate)}</p>
                  </div>
                );
              })}

              {orders.map(order => (
                <div key={order._id} className="rounded-2xl border border-surface-200 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">Pedido #{order.orderNumber || order._id.slice(-6)}</p>
                      <p className="mt-1 text-sm text-slate-500">{order.status}</p>
                    </div>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                      {formatCRMCurrency(order.total)}
                    </span>
                  </div>
                </div>
              ))}

              {carts.map(cart => {
                const cartStatusMeta = getCartStatusMeta(cart.status);
                return (
                  <div key={cart._id} className="rounded-2xl border border-surface-200 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">Carrito con {cart.itemsCount} items</p>
                        <p className="mt-1 text-sm text-slate-500">Ultima actividad: {formatCRMDateTime(cart.lastActivityAt)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cartStatusMeta.badgeClassName}`}>
                        {cartStatusMeta.label}
                      </span>
                    </div>
                  </div>
                );
              })}

              {!tasks.length && !orders.length && !carts.length ? (
                <p className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-slate-500">
                  No hay elementos operativos ligados a este contacto todavia.
                </p>
              ) : null}
            </div>
          </article>
        </section>

        {viewedProducts.length ? (
          <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Productos de interes reciente</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {viewedProducts.map(product => (
                <div key={product._id} className="rounded-2xl border border-surface-200 px-4 py-4">
                  <p className="font-semibold text-slate-950">{product.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{product.code || 'Sin codigo'}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default CRMContactDetailPage;
