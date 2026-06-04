import { useEffect, useState } from 'react';
import { createCRMTask, getCRMTasks, updateCRMTask } from '../../api/crm';

const CRMTasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [contactId, setContactId] = useState('');

  const loadTasks = async () => {
    try {
      const data = await getCRMTasks();
      setTasks(data.tasks || []);
      setStatuses(data.statuses || []);
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
    if (!title.trim() || !contactId.trim()) {
      return;
    }
    await createCRMTask({
      contact: contactId.trim(),
      title: title.trim(),
      type: 'follow_up',
      priority: 'medium'
    });
    setTitle('');
    setContactId('');
    loadTasks();
  };

  const handleStatusChange = async (taskId, status) => {
    await updateCRMTask(taskId, { status });
    loadTasks();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando tareas...</div>;
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-brand-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CRM</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Tareas</h1>
          <p className="mt-2 text-sm text-slate-500">
            Seguimiento operativo para recuperacion, postventa y reactivacion.
          </p>
        </header>

        <form onSubmit={handleQuickTask} className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Crear tarea manual</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <input
              type="text"
              value={contactId}
              onChange={event => setContactId(event.target.value)}
              className="rounded-xl border border-surface-200 px-3 py-2"
              placeholder="ID del contacto"
            />
            <input
              type="text"
              value={title}
              onChange={event => setTitle(event.target.value)}
              className="rounded-xl border border-surface-200 px-3 py-2"
              placeholder="Titulo"
            />
            <button
              type="submit"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Crear
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
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
                  tasks.map(task => (
                    <tr key={task._id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{task.title}</p>
                        <p className="text-slate-500">{task.description || 'Sin descripcion'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {task.contact?.name || 'Sin contacto'}
                      </td>
                      <td className="px-4 py-3">{task.type}</td>
                      <td className="px-4 py-3">{task.status}</td>
                      <td className="px-4 py-3">
                        {task.dueDate ? new Date(task.dueDate).toLocaleString('es-EC') : '--'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <select
                          value={task.status}
                          onChange={event => handleStatusChange(task._id, event.target.value)}
                          className="rounded-lg border border-surface-200 px-3 py-2 text-sm"
                        >
                          {statuses.map(status => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
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
