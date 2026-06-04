import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createCRMNote, createCRMTask, getCRMContactDetail, updateCRMContact } from '../../api/crm';

const CRMContactDetailPage = () => {
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [taskTitle, setTaskTitle] = useState('');

  const loadDetail = useCallback(async () => {
    try {
      const data = await getCRMContactDetail(id);
      setDetail(data);
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
        priority: 'medium'
      });
      setTaskTitle('');
      await loadDetail();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando ficha...</div>;
  }

  if (error || !detail) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error || 'Contacto no encontrado'}</div>;
  }

  const { contact, events = [], tasks = [], notes = [], orders = [], carts = [], suggestedMessages = {} } = detail;

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-brand-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CRM</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">{contact.name || 'Sin nombre'}</h1>
              <p className="mt-2 text-sm text-slate-500">
                {contact.phone || contact.whatsapp || contact.email || 'Sin datos de contacto'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleContactUpdate({ markContacted: true, status: 'contacted' })}
                className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand/30 hover:text-brand"
              >
                Marcar contactado
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleContactUpdate({ status: 'customer' })}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Convertir a cliente
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Estado</p>
            <strong className="mt-2 block text-2xl text-slate-900">{contact.status}</strong>
          </article>
          <article className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Pedidos</p>
            <strong className="mt-2 block text-2xl text-slate-900">{contact.ordersCount || 0}</strong>
          </article>
          <article className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Gasto acumulado</p>
            <strong className="mt-2 block text-2xl text-slate-900">USD {Number(contact.totalSpent || 0).toFixed(2)}</strong>
          </article>
          <article className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Ultima actividad</p>
            <strong className="mt-2 block text-base text-slate-900">
              {contact.lastSeenAt ? new Date(contact.lastSeenAt).toLocaleString('es-EC') : '--'}
            </strong>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
            <div className="mt-4 space-y-3">
              {events.length ? (
                events.map(event => (
                  <div key={event._id} className="rounded-xl border border-surface-200 px-4 py-3">
                    <p className="font-semibold text-slate-900">{event.eventType}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {event.createdAt ? new Date(event.createdAt).toLocaleString('es-EC') : '--'}
                    </p>
                    {event.product?.name && (
                      <p className="mt-1 text-sm text-slate-600">Producto: {event.product.name}</p>
                    )}
                    {event.order?.orderNumber && (
                      <p className="mt-1 text-sm text-slate-600">Pedido: #{event.order.orderNumber}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Sin eventos todavia.</p>
              )}
            </div>
          </article>

          <div className="space-y-6">
            <article className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Mensajes sugeridos</h2>
              <div className="mt-4 space-y-3">
                {Object.entries(suggestedMessages).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-surface-200 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">{key}</p>
                    <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{value || 'Sin sugerencia disponible'}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Nueva tarea</h2>
              <form onSubmit={handleCreateTask} className="mt-4 space-y-3">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={event => setTaskTitle(event.target.value)}
                  className="w-full rounded-xl border border-surface-200 px-3 py-2"
                  placeholder="Ej: Enviar link de producto"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Crear tarea
                </button>
              </form>
            </article>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Notas internas</h2>
            <form onSubmit={handleSaveNote} className="mt-4 space-y-3">
              <textarea
                value={note}
                onChange={event => setNote(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-surface-200 px-3 py-2"
                placeholder="Registrar contexto comercial, objeciones o proximo paso"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand/30 hover:text-brand"
              >
                Guardar nota
              </button>
            </form>
            <div className="mt-4 space-y-3">
              {notes.length ? (
                notes.map(item => (
                  <div key={item._id} className="rounded-xl border border-surface-200 px-4 py-3">
                    <p className="text-sm text-slate-700">{item.note}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.admin?.name || 'Admin'} | {item.createdAt ? new Date(item.createdAt).toLocaleString('es-EC') : '--'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Sin notas registradas.</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Tareas y ordenes</h2>
            <div className="mt-4 space-y-3">
              {tasks.map(task => (
                <div key={task._id} className="rounded-xl border border-surface-200 px-4 py-3">
                  <p className="font-semibold text-slate-900">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{task.status} | {task.type}</p>
                </div>
              ))}
              {orders.map(order => (
                <div key={order._id} className="rounded-xl border border-surface-200 px-4 py-3">
                  <p className="font-semibold text-slate-900">Pedido #{order.orderNumber || order._id.slice(-6)}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {order.status} | USD {Number(order.total || 0).toFixed(2)}
                  </p>
                </div>
              ))}
              {carts.map(cart => (
                <div key={cart._id} className="rounded-xl border border-surface-200 px-4 py-3">
                  <p className="font-semibold text-slate-900">Carrito {cart.status}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {cart.itemsCount} items | USD {Number(cart.subtotal || 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};

export default CRMContactDetailPage;
