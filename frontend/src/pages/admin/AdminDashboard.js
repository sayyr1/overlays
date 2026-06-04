import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../api/axiosInstance';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { useAuth } from '../../context/AuthContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

const formatCurrency = value =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));

const MEMBERSHIP_LEVELS = ['STANDARD', 'GOLD', 'PREMIUM', 'PLATINUM'];

const AdminDashboard = () => {
  const { loading: modulesLoading, isModuleEnabled } = usePublicConfig();
  const { hasPermission } = useAuth();
  const [analytics, setAnalytics] = useState({
    salesToday: 0,
    sales7Days: 0,
    averageTicket: 0,
    topProducts: [],
    dailySeries: []
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState('');

  const reportsEnabled = isModuleEnabled('reports') && hasPermission('reports.view');
  const customersEnabled = isModuleEnabled('customers') && hasPermission('customers.view');
  const membershipsEnabled = isModuleEnabled('memberships') && hasPermission('memberships.manage');

  const loadData = useCallback(async (showSkeleton = true) => {
    if (modulesLoading) {
      return;
    }

    if (showSkeleton) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const requests = [];

      if (reportsEnabled) {
        requests.push(
          axios.get('/api/products/analytics/overview').then(({ data }) => ({ key: 'analytics', data })),
          axios.get('/api/products/summary/sales').then(({ data }) => ({ key: 'summary', data }))
        );
      }

      if (customersEnabled) {
        requests.push(
          axios.get('/api/users', { withCredentials: true }).then(({ data }) => ({ key: 'users', data }))
        );
      }

      const responses = await Promise.all(requests);

      if (reportsEnabled) {
        const analyticsRes = responses.find(item => item.key === 'analytics');
        const summaryRes = responses.find(item => item.key === 'summary');

        setAnalytics(analyticsRes?.data || {
          salesToday: 0,
          sales7Days: 0,
          averageTicket: 0,
          topProducts: [],
          dailySeries: []
        });

        const sortedOrders = [...(summaryRes?.data || [])]
          .filter(order => order.lastSoldAt)
          .sort((a, b) => new Date(b.lastSoldAt) - new Date(a.lastSoldAt))
          .slice(0, 5);
        setRecentOrders(sortedOrders);
      } else {
        setAnalytics({
          salesToday: 0,
          sales7Days: 0,
          averageTicket: 0,
          topProducts: [],
          dailySeries: []
        });
        setRecentOrders([]);
      }

      if (customersEnabled) {
        const usersRes = responses.find(item => item.key === 'users');
        const sortedUsers = Array.isArray(usersRes?.data)
          ? [...usersRes.data].sort((a, b) => a.name.localeCompare(b.name))
          : [];
        setUsers(sortedUsers);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Error cargando datos para el dashboard', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customersEnabled, modulesLoading, reportsEnabled]);

  useEffect(() => {
    if (modulesLoading) {
      return;
    }
    loadData(true);
  }, [loadData, modulesLoading]);

  const chartData = useMemo(() => analytics.dailySeries ?? [], [analytics.dailySeries]);

  const handleMembershipChange = async (userId, membershipLevel) => {
    if (!membershipsEnabled) {
      return;
    }

    setUpdatingUserId(userId);
    try {
      const { data } = await axios.put(
        `/api/users/${userId}/membership`,
        { membershipLevel },
        { withCredentials: true }
      );
      setUsers(prev =>
        prev.map(user => (user._id === userId ? { ...user, membershipLevel: data.membershipLevel } : user))
      );
    } catch (error) {
      console.error('Error al actualizar nivel de cliente', error);
      alert('No se pudo actualizar el nivel de cliente.');
    } finally {
      setUpdatingUserId('');
    }
  };

  const kpiCards = reportsEnabled
    ? [
        {
          label: 'Ventas hoy',
          value: formatCurrency(analytics.salesToday),
          helper: 'Ingresos de las ultimas 24 horas.'
        },
        {
          label: 'Ventas 7 dias',
          value: formatCurrency(analytics.sales7Days),
          helper: 'Total acumulado en la ultima semana.'
        },
        {
          label: 'Ticket promedio',
          value: formatCurrency(analytics.averageTicket),
          helper: 'Valor medio por pedido confirmado.'
        },
        {
          label: 'Producto destacado',
          value: analytics.topProducts?.[0]?.name ?? 'Sin datos',
          helper: analytics.topProducts?.[0]
            ? `${analytics.topProducts[0].units} uds x ${formatCurrency(analytics.topProducts[0].revenue)}`
            : 'Aun no se registran ventas.'
        }
      ]
    : [];

  if (modulesLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 text-slate-500">
        Cargando metricas...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-white/80 px-6 py-6 shadow-brand-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Panel ejecutivo</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Resumen de desempeno</h1>
            <p className="text-sm text-slate-500">
              Vista consolidada segun los modulos activos para este cliente.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {refreshing && <span className="metric-chip text-brand">Actualizando...</span>}
            <button
              type="button"
              onClick={() => loadData(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/40 hover:text-brand"
            >
              Actualizar datos
            </button>
          </div>
        </header>

        {!reportsEnabled && !customersEnabled && (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-brand-sm">
            <h2 className="text-xl font-semibold text-slate-900">Dashboard reducido</h2>
            <p className="mt-3 text-sm text-slate-500">
              Los modulos de reportes y clientes estan desactivados. Activalos desde Super Admin para ampliar esta vista.
            </p>
          </section>
        )}

        {reportsEnabled && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpiCards.map(card => (
                <article key={card.label} className="surface-card flex flex-col gap-3 p-5">
                  <span className="text-xs uppercase tracking-wide text-slate-400">{card.label}</span>
                  <strong className="text-2xl text-slate-900">{card.value}</strong>
                  <span className="text-xs text-slate-500">{card.helper}</span>
                </article>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-[2fr_1.2fr]">
              <div className="surface-card p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Ventas ultimos 30 dias</h2>
                  <span className="text-xs text-slate-500">Series por fecha de pedido</span>
                </div>
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tickFormatter={value => `$${value}`} stroke="#94a3b8" />
                      <Tooltip
                        formatter={value => formatCurrency(value)}
                        labelFormatter={label => `Fecha: ${label}`}
                        contentStyle={{ borderRadius: '0.75rem', borderColor: '#cbd5f5' }}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="surface-card p-6">
                <h2 className="text-lg font-semibold text-slate-900">Top productos</h2>
                <ul className="mt-4 space-y-3">
                  {analytics.topProducts?.length ? (
                    analytics.topProducts.map(product => (
                      <li
                        key={product.name}
                        className="flex items-center justify-between rounded-xl border border-surface-200 px-3 py-3 text-sm text-slate-700"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.units} unidades vendidas</p>
                        </div>
                        <span className="text-sm font-semibold text-slate-800">
                          {formatCurrency(product.revenue)}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-slate-500">No hay ventas registradas.</li>
                  )}
                </ul>
              </div>
            </section>

            <section className="surface-card p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Pedidos recientes</h2>
                <span className="text-xs text-slate-500">Basado en registros confirmados.</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-surface-200">
                  <thead className="bg-surface-100 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Producto</th>
                      <th className="px-4 py-2">Codigo</th>
                      <th className="px-4 py-2">Talla</th>
                      <th className="px-4 py-2 text-right">Cantidad</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200 text-sm text-slate-700">
                    {recentOrders.length ? (
                      recentOrders.map(order => (
                        <tr key={`${order.code}-${order.size}`}>
                          <td className="px-4 py-2">{order.name}</td>
                          <td className="px-4 py-2">{order.code}</td>
                          <td className="px-4 py-2">{order.size}</td>
                          <td className="px-4 py-2 text-right">{order.quantity}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(order.total)}</td>
                          <td className="px-4 py-2">
                            {order.lastSoldAt ? new Date(order.lastSoldAt).toLocaleDateString('es-EC') : '--'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                          Aun no se registran ventas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {customersEnabled && (
          <section className="surface-card p-6">
            <h2 className="text-lg font-semibold text-slate-900">Clientes</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-200">
                <thead className="bg-surface-100 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Nombre</th>
                    <th className="px-4 py-2">Correo</th>
                    <th className="px-4 py-2">Nivel</th>
                    <th className="px-4 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200 text-sm text-slate-700">
                  {users.map(user => (
                    <tr key={user._id}>
                      <td className="px-4 py-2">{user.name}</td>
                      <td className="px-4 py-2">{user.email}</td>
                      <td className="px-4 py-2">{user.membershipLevel}</td>
                      <td className="px-4 py-2 text-right">
                        {membershipsEnabled ? (
                          <select
                            value={user.membershipLevel}
                            onChange={event => handleMembershipChange(user._id, event.target.value)}
                            disabled={updatingUserId === user._id}
                            className="rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                          >
                            {MEMBERSHIP_LEVELS.map(option => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-400">Membresias desactivadas</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
