import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineCalendarDays, HiOutlineClipboardDocumentCheck, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { createCRMTask, getCRMContacts, getCRMTasks, updateCRMTask } from '../../api/crm';
import CRMSectionNav from '../../components/crm/CRMSectionNav';
import {
  formatCRMDateTime,
  getCRMTaskPriorityMeta,
  getCRMTaskStatusMeta,
  getCRMStatusMeta
} from '../../components/crm/crmUi';

const CRMTasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contact: '',
    title: '',
    dueDate: ''
  });

  const loadTasks = async () => {
    try {
      const [tasksData, contactsData] = await Promise.all([getCRMTasks(), getCRMContacts({ onlyActionable: true })]);
      setTasks(tasksData.tasks || []);
      setStatuses(tasksData.statuses || []);
      setContacts(contactsData.contacts || []);
      setError('');
    } catch {
      setError('No se pudo cargar la lista de tareas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleQuickTask = async event => {
    event.preventDefault();
    if (!form.title.trim() || !form.contact) {
      return;
    }

    const selectedContact = contacts.find(contact => contact._id === form.contact);

    setSaving(true);
    try {
      await createCRMTask({
        contact: form.contact,
        contactName: selectedContact?.name || '',
        title: form.title.trim(),
        type: 'follow_up',
        priority: 'medium',
        dueDate: form.dueDate || null
      });
      setForm({
        contact: '',
        title: '',
        dueDate: ''
      });
      await loadTasks();
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (taskId, status) => {
    setSaving(true);
    try {
      await updateCRMTask(taskId, { status });
      await loadTasks();
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter(task => task.status === 'pending').length,
      overdue: tasks.filter(task => task.status === 'overdue').length,
      done: tasks.filter(task => task.status === 'done').length
    }),
    [tasks]
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando tareas...</div>;
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <CRMSectionNav />

        <header className="overflow-hidden rounded-[2rem] bg-white p-6 shadow-brand-sm">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CRM</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">Tareas</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Seguimiento operativo para leads, recuperacion de carritos, postventa y reactivacion.
              </p>
            </div>
            <div className="grid gap-3 rounded-3xl border border-surface-200 bg-slate-50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Total</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.total}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Pendientes</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.pending}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Vencidas</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.overdue}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
          <form onSubmit={handleQuickTask} className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <HiOutlineClipboardDocumentCheck className="text-2xl" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Crear tarea manual</h2>
                <p className="text-sm text-slate-500">Genera seguimiento sin salir del CRM.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4">
              <label className="text-sm text-slate-600">
                Contacto
                <select
                  value={form.contact}
                  onChange={event => setForm(prev => ({ ...prev, contact: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                >
                  <option value="">Selecciona un contacto</option>
                  {contacts.map(contact => (
                    <option key={contact._id} value={contact._id}>
                      {(contact.name || 'Sin nombre')} - {contact.phone || contact.whatsapp || contact.email || 'Sin contacto'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Titulo
                <input
                  type="text"
                  value={form.title}
                  onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                  placeholder="Ej: Confirmar talla disponible"
                />
              </label>
              <label className="text-sm text-slate-600">
                Vence
                <input
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={event => setForm(prev => ({ ...prev, dueDate: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Crear tarea'}
              </button>
            </div>
          </form>

          <div className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  <HiOutlineCalendarDays className="text-2xl" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Pendientes</p>
                  <p className="mt-1 text-3xl font-semibold text-slate-950">{summary.pending}</p>
                </div>
              </div>
            </article>
            <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                  <HiOutlineExclamationTriangle className="text-2xl" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Vencidas</p>
                  <p className="mt-1 text-3xl font-semibold text-slate-950">{summary.overdue}</p>
                </div>
              </div>
            </article>
            <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Completadas</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.done}</p>
              <p className="mt-2 text-sm text-slate-500">Seguimientos ya ejecutados por el equipo.</p>
            </article>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 lg:hidden">
          {tasks.length ? (
            tasks.map(task => {
              const statusMeta = getCRMTaskStatusMeta(task.status);
              const priorityMeta = getCRMTaskPriorityMeta(task.priority);
              const contactStatusMeta = getCRMStatusMeta(task.contact?.status);
              return (
                <article key={task._id} className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{task.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{task.description || 'Sin descripcion registrada.'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
                        {statusMeta.label}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityMeta.badgeClassName}`}>
                        {priorityMeta.label}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Contacto</p>
                      {task.contact?._id ? (
                        <Link to={`/crm/contactos/${task.contact._id}`} className="mt-1 inline-flex font-semibold text-brand hover:text-brand-dark">
                          {task.contact?.name || 'Sin nombre'}
                        </Link>
                      ) : (
                        <p className="mt-1 text-sm text-slate-700">Sin contacto</p>
                      )}
                      {task.contact?.status ? (
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${contactStatusMeta.badgeClassName}`}>
                          {contactStatusMeta.label}
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Vence</p>
                      <p className="mt-1 text-sm text-slate-700">{formatCRMDateTime(task.dueDate)}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <select
                      value={task.status}
                      onChange={event => handleStatusChange(task._id, event.target.value)}
                      className="w-full rounded-2xl border border-surface-200 px-3 py-2 text-sm"
                    >
                      {statuses.map(status => (
                        <option key={status} value={status}>
                          {getCRMTaskStatusMeta(status).label}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-3xl border border-surface-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              No hay tareas registradas.
            </div>
          )}
        </section>

        <section className="hidden rounded-3xl border border-surface-200 bg-white p-5 shadow-sm lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-200">
              <thead className="bg-surface-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tarea</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Vence</th>
                  <th className="px-4 py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 text-sm text-slate-700">
                {tasks.length ? (
                  tasks.map(task => {
                    const statusMeta = getCRMTaskStatusMeta(task.status);
                    const priorityMeta = getCRMTaskPriorityMeta(task.priority);
                    return (
                      <tr key={task._id} className="transition hover:bg-surface-50">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950">{task.title}</p>
                          <p className="text-slate-500">{task.description || 'Sin descripcion'}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityMeta.badgeClassName}`}>
                              {priorityMeta.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {task.contact?._id ? (
                            <Link to={`/crm/contactos/${task.contact._id}`} className="font-semibold text-brand hover:text-brand-dark">
                              {task.contact?.name || 'Sin nombre'}
                            </Link>
                          ) : (
                            'Sin contacto'
                          )}
                        </td>
                        <td className="px-4 py-4">{task.type}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">{formatCRMDateTime(task.dueDate)}</td>
                        <td className="px-4 py-4 text-right">
                          <select
                            value={task.status}
                            onChange={event => handleStatusChange(task._id, event.target.value)}
                            className="rounded-2xl border border-surface-200 px-3 py-2 text-sm"
                          >
                            {statuses.map(status => (
                              <option key={status} value={status}>
                                {getCRMTaskStatusMeta(status).label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      No hay tareas registradas.
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

export default CRMTasksPage;
