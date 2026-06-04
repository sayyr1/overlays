import { useEffect, useState } from 'react';
import { getCRMConfig, updateCRMConfig } from '../../api/crm';

const CRMConfigPage = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getCRMConfig()
      .then(data => {
        setConfig(data);
        setError('');
      })
      .catch(() => {
        setError('No se pudo cargar la configuracion CRM.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleChange = event => {
    const { name, value, type, checked } = event.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const nextConfig = await updateCRMConfig(config);
      setConfig(nextConfig);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando configuracion CRM...</div>;
  }

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error || 'No hay configuracion disponible.'}</div>;
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-brand-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CRM</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Configuracion</h1>
          <p className="mt-2 text-sm text-slate-500">
            Ajustes de abandono, reactivacion, VIP y seguimiento automatico.
          </p>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600">
              Horas para abandono
              <input
                type="number"
                name="abandonedCartHours"
                value={config.abandonedCartHours || 0}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-600">
              Dias postventa
              <input
                type="number"
                name="postSaleFollowUpDays"
                value={config.postSaleFollowUpDays || 0}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-600">
              Dias para inactividad
              <input
                type="number"
                name="inactiveCustomerDays"
                value={config.inactiveCustomerDays || 0}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-600">
              Umbral VIP
              <input
                type="number"
                name="vipSpendThreshold"
                value={config.vipSpendThreshold || 0}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-600">
              Stock bajo
              <input
                type="number"
                name="lowStockThreshold"
                value={config.lowStockThreshold || 0}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-600">
              Pedidos para cliente frecuente
              <input
                type="number"
                name="frequentCustomerOrdersThreshold"
                value={config.frequentCustomerOrdersThreshold || 0}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2"
              />
            </label>
          </div>

          <label className="mt-6 flex items-center gap-3 text-sm text-slate-600">
            <input
              type="checkbox"
              name="trackingEnabled"
              checked={Boolean(config.trackingEnabled)}
              onChange={handleChange}
            />
            Activar tracking CRM en storefront
          </label>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar configuracion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CRMConfigPage;
