import React, { useEffect, useState } from 'react';
import { getSuperAdminBranding, updateSuperAdminBranding } from '../../api/superAdmin';
import { usePublicConfig } from '../../context/PublicConfigContext';

const BrandingSettingsPage = () => {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const { setPublicBranding } = usePublicConfig();

  useEffect(() => {
    const load = async () => {
      const { data } = await getSuperAdminBranding();
      setForm({
        logoUrl: data?.logoUrl || '',
        faviconUrl: data?.faviconUrl || '',
        navbarName: data?.navbarName || '',
        primaryColor: data?.primaryColor || '#0f766e',
        secondaryColor: data?.secondaryColor || '#111827',
        backgroundColor: data?.backgroundColor || '#0b1220',
        textColor: data?.textColor || '#0f172a',
        visualStyle: data?.visualStyle || 'default'
      });
    };
    load();
  }, []);

  if (!form) {
    return <div className="rounded-3xl bg-white p-8 shadow-brand-sm">Cargando branding...</div>;
  }

  const handleChange = event => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await updateSuperAdminBranding(form);
      setPublicBranding(data);
      window.alert('Branding actualizado.');
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No se pudo actualizar el branding.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl bg-white p-8 shadow-brand-sm">
      <h2 className="text-2xl font-semibold text-slate-900">Branding</h2>
      <p className="mt-2 text-sm text-slate-500">Identidad visual compartida por la tienda.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ['navbarName', 'Nombre visible en navbar'],
            ['logoUrl', 'Logo URL'],
            ['faviconUrl', 'Favicon URL'],
            ['visualStyle', 'Estilo visual']
          ].map(([name, label]) => (
            <label key={name} className="text-sm font-medium text-slate-700">
              {label}
              <input
                name={name}
                value={form[name]}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['primaryColor', 'Color primario'],
            ['secondaryColor', 'Color secundario'],
            ['backgroundColor', 'Color de fondo'],
            ['textColor', 'Color de texto']
          ].map(([name, label]) => (
            <label key={name} className="text-sm font-medium text-slate-700">
              {label}
              <input
                type="color"
                name={name}
                value={form[name]}
                onChange={handleChange}
                className="mt-1 h-12 w-full rounded-xl border border-slate-200 px-2 py-2"
              />
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar branding'}
        </button>
      </form>
    </section>
  );
};

export default BrandingSettingsPage;
