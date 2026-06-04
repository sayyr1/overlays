import React, { useEffect, useState } from 'react';
import { getSuperAdminSettings, updateSuperAdminSettings } from '../../api/superAdmin';
import { usePublicConfig } from '../../context/PublicConfigContext';

const emptySocials = { facebook: '', instagram: '', tiktok: '', x: '' };

const GeneralSettingsPage = () => {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const { setPublicSettings } = usePublicConfig();

  useEffect(() => {
    const load = async () => {
      const { data } = await getSuperAdminSettings();
      const socialLinks = data?.socialLinks || {};
      setForm({
        businessName: data?.businessName || '',
        tradeName: data?.tradeName || '',
        country: data?.country || '',
        currency: data?.currency || '',
        timezone: data?.timezone || '',
        contactEmail: data?.contactEmail || '',
        phone: data?.phone || '',
        whatsapp: data?.whatsapp || '',
        address: data?.address || '',
        footerText: data?.footerText || '',
        socialLinks: {
          ...emptySocials,
          ...socialLinks
        }
      });
    };
    load();
  }, []);

  if (!form) {
    return <div className="rounded-3xl bg-white p-8 shadow-brand-sm">Cargando configuracion...</div>;
  }

  const handleChange = event => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSocialChange = event => {
    const { name, value } = event.target;
    setForm(prev => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [name]: value
      }
    }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await updateSuperAdminSettings(form);
      setPublicSettings(data);
      window.alert('Configuracion general actualizada.');
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No se pudo actualizar la configuracion.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl bg-white p-8 shadow-brand-sm">
      <h2 className="text-2xl font-semibold text-slate-900">Configuracion general</h2>
      <p className="mt-2 text-sm text-slate-500">Datos base visibles para la tienda y el cliente.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ['businessName', 'Nombre de empresa'],
            ['tradeName', 'Nombre comercial'],
            ['country', 'Pais'],
            ['currency', 'Moneda'],
            ['timezone', 'Zona horaria'],
            ['contactEmail', 'Email de contacto'],
            ['phone', 'Telefono'],
            ['whatsapp', 'WhatsApp']
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

        <label className="block text-sm font-medium text-slate-700">
          Direccion
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Texto del footer
          <textarea
            name="footerText"
            value={form.footerText}
            onChange={handleChange}
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          {Object.keys(form.socialLinks).map(key => (
            <label key={key} className="text-sm font-medium capitalize text-slate-700">
              {key}
              <input
                name={key}
                value={form.socialLinks[key]}
                onChange={handleSocialChange}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar configuracion'}
        </button>
      </form>
    </section>
  );
};

export default GeneralSettingsPage;
