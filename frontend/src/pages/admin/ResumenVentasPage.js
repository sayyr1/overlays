import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../api/axiosInstance';

const formatCurrency = value =>
  new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const formatDateTime = value => {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString();
};

const getPriceSourceLabel = value => (value === 'manual' ? 'Manual' : 'Detallado');

const ResumenVentasPage = () => {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');

  const fetchResumen = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await axios.get('/api/products/summary/sales');
      setVentas(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError('No se pudo cargar el resumen de ventas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumen();
  }, []);

  const summary = useMemo(() => {
    const totalRevenue = ventas.reduce((acc, item) => acc + Number(item.total || 0), 0);
    const totalUnits = ventas.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
    const uniqueProducts = new Set(ventas.map(item => `${item.code || ''}-${item.name || ''}`)).size;
    const lastSaleAt = ventas.reduce((latest, item) => {
      const currentDate = item.lastSoldAt ? new Date(item.lastSoldAt).getTime() : 0;
      return currentDate > latest ? currentDate : latest;
    }, 0);

    return {
      totalRevenue,
      totalUnits,
      uniqueProducts,
      movements: ventas.length,
      lastSaleAt: lastSaleAt ? new Date(lastSaleAt).toLocaleString() : 'Sin ventas'
    };
  }, [ventas]);

  const topLines = useMemo(
    () =>
      [...ventas]
        .sort((left, right) => Number(right.total || 0) - Number(left.total || 0))
        .slice(0, 5),
    [ventas]
  );

  const handleReset = async () => {
    const confirmReset = window.confirm(
      'Se borrara todo el historial consolidado de ventas. Quieres continuar?'
    );

    if (!confirmReset) return;

    setIsResetting(true);
    setError('');

    try {
      await axios.post('/api/products/reset-sales');
      await fetchResumen();
    } catch (err) {
      setError('No se pudo reiniciar el historial de ventas.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold text-slate-900">Resumen de ventas</h1>
                <span className="metric-chip">{summary.movements} movimientos</span>
              </div>
              <p className="max-w-3xl text-sm text-slate-500">
                Revisa ingresos, volumen vendido y los productos que mas aportan al consolidado actual.
              </p>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Ultima venta: {summary.lastSaleAt}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={fetchResumen}
                className="rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
              >
                Actualizar
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isResetting || loading || ventas.length === 0}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResetting ? 'Reiniciando...' : 'Resetear historial'}
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-surface-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Facturacion</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatCurrency(summary.totalRevenue)}
            </p>
          </div>
          <div className="rounded-2xl border border-surface-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Unidades</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.totalUnits}</p>
          </div>
          <div className="rounded-2xl border border-surface-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Productos</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.uniqueProducts}</p>
          </div>
          <div className="rounded-2xl border border-surface-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Movimientos</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.movements}</p>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-surface-200 bg-white px-6 py-14 text-center text-slate-500 shadow-sm">
            Cargando resumen...
          </div>
        ) : ventas.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-surface-200 bg-white px-6 py-14 text-center text-slate-500 shadow-sm">
            <p className="mb-2 text-lg font-semibold text-slate-700">Sin ventas registradas</p>
            <p className="text-sm">
              Cuando existan movimientos confirmados apareceran aqui con sus totales y fechas.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <section className="overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-sm">
              <div className="border-b border-surface-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Detalle de ventas</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Vista consolidada por producto, talla y fecha de venta.
                </p>
              </div>

              <div className="md:hidden">
                <div className="space-y-3 p-4">
                  {ventas.map((item, index) => (
                    <article
                      key={`${item.code || 'item'}-${index}`}
                      className="rounded-2xl border border-surface-200 bg-surface-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                            Cod. {item.code || 'S/C'} / Talla {item.size || 'N/A'}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="metric-chip">Cant. {item.quantity}</span>
                        <span className="metric-chip">Unit. {formatCurrency(item.price)}</span>
                        <span className="metric-chip">{getPriceSourceLabel(item.priceSource)}</span>
                      </div>
                      <p className="mt-3 text-xs text-slate-400">
                        {formatDateTime(item.lastSoldAt)}
                      </p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full divide-y divide-surface-200">
                  <thead className="bg-surface-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Producto</th>
                      <th className="px-4 py-3 font-semibold">Codigo</th>
                      <th className="px-4 py-3 font-semibold">Talla</th>
                      <th className="px-4 py-3 font-semibold">Cantidad</th>
                      <th className="px-4 py-3 font-semibold">Tipo</th>
                      <th className="px-4 py-3 font-semibold">Unitario</th>
                      <th className="px-4 py-3 font-semibold">Total</th>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200 text-sm text-slate-700">
                    {ventas.map((item, index) => (
                      <tr key={`${item.code || 'row'}-${index}`}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="px-4 py-3">{item.code || 'S/C'}</td>
                        <td className="px-4 py-3">{item.size || 'N/A'}</td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        <td className="px-4 py-3">{getPriceSourceLabel(item.priceSource)}</td>
                        <td className="px-4 py-3">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {formatCurrency(item.total)}
                        </td>
                        <td className="px-4 py-3">{formatDateTime(item.lastSoldAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="space-y-6">
              <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Top lineas</h2>
                <div className="mt-4 space-y-3">
                  {topLines.map((item, index) => (
                    <div
                      key={`${item.code || 'top'}-${index}`}
                      className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.quantity} uds / Talla {item.size || 'N/A'}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Cierre rapido</h2>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p className="flex justify-between gap-4">
                    <span>Total general</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(summary.totalRevenue)}
                    </span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span>Ultima venta</span>
                    <span className="text-right text-slate-900">{summary.lastSaleAt}</span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span>Productos distintos</span>
                    <span className="font-semibold text-slate-900">{summary.uniqueProducts}</span>
                  </p>
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumenVentasPage;
