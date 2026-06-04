import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCRMDashboard } from '../../api/crm';

const CRMDashboardPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getCRMDashboard()
      .then(data => {
        setDashboard(data);
        setError('');
      })
      .catch(() => {
        setError('No se pudo cargar el dashboard CRM.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando CRM...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }

  const metrics = dashboard?.metrics || {};

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-brand-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CRM</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Centro comercial</h1>
          <p className="mt-2 text-sm text-slate-500">
            Leads, tareas y oportunidades conectadas al comportamiento real de tienda.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Leads nuevos', metrics.leadsNew],
            ['Carritos abandonados', metrics.abandonedCarts],
            ['Tareas para hoy', metrics.tasksDueToday],
            ['Tareas vencidas', metrics.tasksOverdue],
            ['Clientes nuevos', metrics.newCustomers],
            ['Clientes recurrentes', metrics.recurrentCustomers],
            ['Clientes inactivos', metrics.inactiveCustomers]
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
              <strong className="mt-2 block text-3xl text-slate-900">{value || 0}</strong>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <article className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Productos con mayor interes</h2>
              <Link to="/crm/pipeline" className="text-sm font-semibold text-brand hover:text-brand-dark">
                Ver pipeline
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {(dashboard?.topInterestProducts || []).length ? (
                dashboard.topInterestProducts.map(item => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between rounded-xl border border-surface-200 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-500">
                        Interes: {item.interestCount} | Stock: {item.stock}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {item.lastActivity ? new Date(item.lastActivity).toLocaleDateString('es-EC') : '--'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Todavia no hay actividad suficiente.</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Acciones sugeridas</h2>
            <div className="mt-4 space-y-3">
              {(dashboard?.recommendedActions || []).length ? (
                dashboard.recommendedActions.map(action => (
                  <div key={action.taskId || action.title} className="rounded-xl border border-surface-200 px-4 py-3">
                    <p className="font-semibold text-slate-900">{action.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{action.description || 'Sin descripcion'}</p>
                    {action.contactId && (
                      <Link
                        to={`/crm/contactos/${action.contactId}`}
                        className="mt-3 inline-flex text-sm font-semibold text-brand hover:text-brand-dark"
                      >
                        Abrir contacto
                      </Link>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No hay acciones urgentes en este momento.</p>
              )}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Interes alto con stock bajo</h2>
            <Link to="/crm/carritos-abandonados" className="text-sm font-semibold text-brand hover:text-brand-dark">
              Ver recuperacion
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(dashboard?.productsHighInterestLowStock || []).length ? (
              dashboard.productsHighInterestLowStock.map(item => (
                <div key={item.productId} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="mt-1 text-sm text-amber-700">
                    Interes acumulado: {item.interestCount} | Stock: {item.stock}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No hay productos en zona de riesgo.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CRMDashboardPage;
