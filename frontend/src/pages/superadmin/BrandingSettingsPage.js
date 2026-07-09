import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSuperAdminBranding,
  updateSuperAdminBranding,
  uploadSuperAdminBrandingLogo
} from '../../api/superAdmin';
import { usePublicConfig } from '../../context/PublicConfigContext';

const BrandingSettingsPage = () => {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const { setPublicBranding, reloadSection } = usePublicConfig();
  const fileInputRef = useRef(null);

  const applyBrandingPayload = useCallback(data => {
    setForm({
      navbarName: data?.navbarName || '',
      visualStyle: data?.visualStyle || 'default',
      logoUrl: data?.logoUrl || '',
      faviconUrl: data?.faviconUrl || '',
      logoPublicId: data?.logoPublicId || '',
      faviconPublicId: data?.faviconPublicId || ''
    });
    setPublicBranding(data);
  }, [setPublicBranding]);

  useEffect(() => {
    const load = async () => {
      const { data } = await getSuperAdminBranding();
      applyBrandingPayload(data);
    };
    load();
  }, [applyBrandingPayload]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl('');
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [logoFile]);

  if (!form) {
    return <div className="theme-panel rounded-3xl p-8">Cargando branding...</div>;
  }

  const handleChange = event => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoFileChange = event => {
    const nextFile = event.target.files?.[0] || null;
    setLogoFile(nextFile);
  };
  const handleLogoUpload = async () => {
    if (!logoFile) {
      window.alert('Selecciona un archivo primero.');
      return;
    }

    setUploadingLogo(true);
    try {
      const payload = new FormData();
      payload.append('logo', logoFile);
      const { data } = await uploadSuperAdminBrandingLogo(payload);
      applyBrandingPayload(data);
      await reloadSection('branding');
      setLogoFile(null);
      setLogoPreviewUrl('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      window.alert('Logo subido y favicon actualizado.');
    } catch (error) {
      const serverMessage = error?.response?.data?.message;
      const statusCode = error?.response?.status;
      window.alert(serverMessage || (statusCode ? `No se pudo subir el logo. (${statusCode})` : 'No se pudo subir el logo.'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await updateSuperAdminBranding({
        navbarName: form.navbarName,
        visualStyle: form.visualStyle
      });
      applyBrandingPayload(data);
      await reloadSection('branding');
      window.alert('Branding actualizado.');
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No se pudo actualizar el branding.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="theme-panel rounded-3xl p-8">
      <h2 className="text-2xl font-semibold">Branding</h2>
      <p className="mt-2 text-sm" style={{ color: 'var(--muted-color)' }}>
        Identidad base de la marca. Los temas visuales por superficie se manejan aparte.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="rounded-2xl border border-surface-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Logo y favicon</h3>
              <p className="mt-1 text-sm text-slate-600">
                Sube el logo a Cloudinary y el sistema reutiliza el mismo archivo como favicon automaticamente.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleLogoFileChange}
                className="theme-input rounded-xl px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleLogoUpload}
                disabled={uploadingLogo || !logoFile}
                className="theme-button-primary rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {uploadingLogo ? 'Subiendo...' : 'Subir logo'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-surface-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Logo actual</p>
              <div className="branding-preview-grid mt-3 flex min-h-[140px] items-center justify-center rounded-2xl p-4">
                {logoPreviewUrl || form.logoUrl ? (
                  <img
                    src={logoPreviewUrl || form.logoUrl}
                    alt={logoPreviewUrl ? 'Preview del logo seleccionado' : 'Logo actual'}
                    className="max-h-24 w-auto max-w-full object-contain drop-shadow-[0_8px_18px_rgba(15,23,42,0.18)]"
                  />
                ) : (
                  <span className="text-sm text-slate-400">Sin logo</span>
                )}
              </div>
              {logoFile ? (
                <p className="mt-3 text-xs text-slate-500">
                  Preview pendiente: {logoFile.name}
                </p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-surface-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Favicon actual</p>
              <div className="branding-preview-grid mt-3 flex min-h-[140px] items-center justify-center rounded-2xl p-4">
                {form.faviconUrl ? (
                  <img
                    src={form.faviconUrl}
                    alt="Favicon actual"
                    className="h-14 w-14 object-contain drop-shadow-[0_8px_18px_rgba(15,23,42,0.18)]"
                  />
                ) : (
                  <span className="text-sm text-slate-400">Sin favicon</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            ['navbarName', 'Nombre visible en navbar'],
            ['visualStyle', 'Estilo visual']
          ].map(([name, label]) => (
            <label key={name} className="text-sm font-medium text-slate-700">
              {label}
              <input
                name={name}
                value={form[name]}
                onChange={handleChange}
                className="theme-input mt-1 w-full rounded-xl px-3 py-2"
              />
            </label>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-surface-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Logo URL</p>
            <p className="mt-2 break-all">{form.logoUrl || 'Sin logo'}</p>
          </div>
          <div className="rounded-2xl border border-surface-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Favicon URL</p>
            <p className="mt-2 break-all">{form.faviconUrl || 'Sin favicon'}</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="theme-button-primary rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar branding'}
        </button>
      </form>
    </section>
  );
};

export default BrandingSettingsPage;
