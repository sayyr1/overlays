import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineArrowTrendingUp, HiOutlineBolt, HiOutlineExclamationTriangle, HiOutlineUserGroup } from 'react-icons/hi2';
import { getCRMDashboard } from '../../api/crm';
import CRMSectionNav from '../../components/crm/CRMSectionNav';
import { formatCRMDate, formatCRMCurrency } from '../../components/crm/crmUi';

const metricCards = metrics => [
  {
    label: 'Leads nuevos',
    value: metrics.leadsNew || 0,
    helper: 'Contactos que siguen en la etapa inicial del pipeline.',
    tone: 'bg-sky-50 text-sky-700 ring-sky-200'
  },
  {
    label: 'Interesados',
    value: metrics.interestedLeads || 0,
    helper: 'Contactos que ya avanzaron a checkout, carrito o pedido.',
    tone: 'bg-indigo-50 text-indigo-700 ring-indigo-200'
  },
  {
    label: 'Carritos abandonados',
    value: metrics.abandonedCarts || 0,
    helper: 'Oportunidades calientes con valor detectado.',
    tone: 'bg-rose-50 text-rose-700 ring-rose-200'
  },
  {
    label: 'Tareas para hoy',
    value: metrics.tasksDueToday || 0,
    helper: 'Seguimientos que deberian ejecutarse hoy.',
    tone: 'bg-amber-50 text-amber-700 ring-amber-200'
  },
  {
    label: 'Tareas vencidas',
    value: metrics.tasksOverdue || 0,
    helper: 'Riesgo operativo por falta de seguimiento.',
    tone: 'bg-red-50 text-red-700 ring-red-200'
  },
  {
    label: 'Sin siguiente accion',
    value: metrics.actionableWithoutTask || 0,
    helper: 'Contactos accionables que aun no tienen tarea abierta.',
    tone: 'bg-orange-50 text-orange-700 ring-orange-200'
  },
  {
    label: 'Clientes nuevos',
    value: metrics.newCustomers || 0,
    helper: 'Contactos convertidos en los ultimos 7 dias.',
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  },
  {
    label: 'Clientes recurrentes',
    value: metrics.recurrentCustomers || 0,
    helper: 'Base que ya repitio compra.',
    tone: 'bg-violet-50 text-violet-700 ring-violet-200'
  },
  {
    label: 'Clientes inactivos',
    value: metrics.inactiveCustomers || 0,
    helper: 'Contactos listos para reactivacion.',
    tone: 'bg-stone-50 text-stone-700 ring-stone-200'
  }
];

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

  const metrics = dashboard?.metrics || {};
  const cards = metricCards(metrics);
  const urgentItems = (dashboard?.recommendedActions || []).slice(0, 5);
  const riskItems = dashboard?.productsHighInterestLowStock || [];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando CRM...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <CRMSectionNav />

        <header className="overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-7 text-white shadow-brand-sm">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">CRM</p>
              <h1 className="mt-3 text-3xl font-semibold lg:text-4xl">Centro comercial</h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70">
                Prioriza seguimiento, recupera oportunidades y convierte interes real de tienda en ventas visibles.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/crm/pipeline"
                  className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
                >
                  Abrir pipeline
                </Link>
                <Link
                  to="/crm/tareas"
                  className="inline-flex items-center rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Revisar tareas
                </Link>
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-200">
                  <HiOutlineArrowTrendingUp className="text-2xl" />
                </span>
                <div>
                  <p className="text-sm text-white/60">Embudo vivo</p>
                  <p className="text-lg font-semibold">{(metrics.leadsNew || 0) + (metrics.abandonedCarts || 0)} oportunidades activas</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-wide text-white/45">Urgentes</p>
                  <p className="mt-1 text-2xl font-semibold">{metrics.tasksOverdue || 0}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-wide text-white/45">Recuperables</p>
                  <p className="mt-1 text-2xl font-semibold">{metrics.abandonedCarts || 0}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-wide text-white/45">Recompra</p>
                  <p className="mt-1 text-2xl font-semibold">{metrics.recurrentCustomers || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(card => (
            <article key={card.label} className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
              <div className={`inline-flex rounded-2xl px-3 py-1 text-xs font-semibold ring-1 ring-inset ${card.tone}`}>
                {card.label}
              </div>
              <strong className="mt-4 block text-4xl font-semibold text-slate-950">{card.value}</strong>
              <p className="mt-2 text-sm leading-6 text-slate-500">{card.helper}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Radar comercial</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">Productos con mayor interes</h2>
              </div>
              <Link to="/crm/pipeline" className="text-sm font-semibold text-brand hover:text-brand-dark">
                Ver pipeline
              </Link>
            </div>
            <div className="mt-5 grid gap-3">
              {(dashboard?.topInterestProducts || []).length ? (
                dashboard.topInterestProducts.slice(0, 6).map(item => (
                  <div
                    key={item.productId}
                    className="grid gap-3 rounded-2xl border border-surface-200 p-4 transition hover:border-brand/20 hover:bg-surface-50 sm:grid-cols-[1.2fr_0.6fr_0.5fr]"
                  >
                    <div>
                      <p className="font-semibold text-slate-950">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-500">Ultima actividad: {formatCRMDate(item.lastActivity)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Interes</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-950">{item.interestCount}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Stock</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-950">{item.stock}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-slate-500">
                  Todavia no hay actividad suficiente para construir el radar comercial.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <HiOutlineBolt className="text-2xl" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Ejecucion</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Acciones sugeridas</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {urgentItems.length ? (
                urgentItems.map(action => (
                  <div key={action.taskId || action.title} className="rounded-2xl border border-surface-200 p-4">
                    <p className="font-semibold text-slate-950">{action.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{action.description || 'Sin descripcion registrada.'}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                        Seguimiento sugerido
                      </span>
                      {action.contactId && (
                        <Link
                          to={`/crm/contactos/${action.contactId}`}
                          className="text-sm font-semibold text-brand hover:text-brand-dark"
                        >
                          Abrir contacto
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-slate-500">
                  No hay acciones urgentes. El equipo esta al dia.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <HiOutlineExclamationTriangle className="text-2xl" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Riesgo</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Interes alto con stock bajo</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {riskItems.length ? (
                riskItems.map(item => (
                  <div key={item.productId} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{item.name}</p>
                        <p className="mt-1 text-sm text-amber-800">
                          {item.interestCount} interacciones con solo {item.stock} unidades disponibles.
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                        Prioridad alta
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-slate-500">
                  No hay productos en zona de riesgo por ahora.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <HiOutlineUserGroup className="text-2xl" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Valor comercial</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Lectura rapida del embudo</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Clientes nuevos</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{metrics.newCustomers || 0}</p>
                <p className="mt-2 text-sm text-slate-500">Conversion reciente detectada por CRM.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Base recurrente</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{metrics.recurrentCustomers || 0}</p>
                <p className="mt-2 text-sm text-slate-500">Contactos con mas de una orden.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Inactivos</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{metrics.inactiveCustomers || 0}</p>
                <p className="mt-2 text-sm text-slate-500">Listos para campanas de reactivacion.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Valor estimado recuperable</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{formatCRMCurrency((metrics.abandonedCarts || 0) * 25)}</p>
                <p className="mt-2 text-sm text-slate-500">Lectura operativa rapida basada en abandonos activos.</p>
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};

export default CRMDashboardPage;
