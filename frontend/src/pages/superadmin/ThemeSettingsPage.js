import React, { useEffect, useMemo, useState } from 'react';
import {
  getSuperAdminThemes,
  updateSuperAdminTheme
} from '../../api/superAdmin';
import { usePublicConfig } from '../../context/PublicConfigContext';
import {
  BUTTON_STYLE_OPTIONS,
  FONT_OPTIONS,
  FORM_STYLE_OPTIONS,
  NAV_STYLE_OPTIONS,
  PANEL_STYLE_OPTIONS,
  THEME_SCOPE_OPTIONS
} from '../../utils/themeRuntime';

const ThemeSettingsPage = () => {
  const [themes, setThemes] = useState([]);
  const [activeScope, setActiveScope] = useState('storefront');
  const [savingScope, setSavingScope] = useState('');
  const { setPublicThemes, upsertPublicTheme } = usePublicConfig();

  useEffect(() => {
    const load = async () => {
      const { data } = await getSuperAdminThemes();
      const nextThemes = Array.isArray(data) ? data : [];
      setThemes(nextThemes);
      setPublicThemes(nextThemes);
    };

    load();
  }, [setPublicThemes]);

  const activeTheme = useMemo(
    () => themes.find(item => item.scope === activeScope) || null,
    [activeScope, themes]
  );

  const updateField = (field, value) => {
    setThemes(prev =>
      prev.map(item => (item.scope === activeScope ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = async () => {
    if (!activeTheme) return;
    setSavingScope(activeScope);

    try {
      const { data } = await updateSuperAdminTheme(activeScope, activeTheme);
      setThemes(prev =>
        prev.map(item => (item.scope === activeScope ? data : item))
      );
      upsertPublicTheme(data);
      window.alert(`Tema ${activeScope} actualizado.`);
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No se pudo guardar el tema.');
    } finally {
      setSavingScope('');
    }
  };

  if (!activeTheme) {
    return <section className="theme-panel rounded-[28px] p-8">Cargando temas...</section>;
  }

  const previewStyle = {
    backgroundColor: activeTheme.backgroundColor,
    color: activeTheme.textColor,
    fontFamily: activeTheme.fontBody,
    borderColor: activeTheme.primaryColor
  };

  return (
    <section className="space-y-6">
      <div className="theme-panel rounded-[28px] p-8">
        <h2 className="text-3xl font-semibold">Temas por superficie</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted-color)' }}>
          Separa la apariencia de tienda, admin y superadmin sin mezclar branding con layout.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {THEME_SCOPE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setActiveScope(option.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeScope === option.value
                  ? 'theme-button-primary'
                  : 'theme-button-secondary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <article className="theme-panel rounded-[28px] p-8">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-medium">
              Etiqueta interna
              <input
                value={activeTheme.label || ''}
                onChange={event => updateField('label', event.target.value)}
                className="theme-input mt-1 w-full rounded-2xl px-3 py-2.5"
              />
            </label>

            <label className="text-sm font-medium">
              Estilo de navegacion
              <select
                value={activeTheme.navStyle || 'solid'}
                onChange={event => updateField('navStyle', event.target.value)}
                className="theme-input mt-1 w-full rounded-2xl px-3 py-2.5"
              >
                {NAV_STYLE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['primaryColor', 'Color primario'],
              ['accentColor', 'Color acento'],
              ['backgroundColor', 'Fondo app'],
              ['surfaceColor', 'Fondo panel'],
              ['textColor', 'Texto base'],
              ['headingColor', 'Titulos'],
              ['mutedColor', 'Texto secundario']
            ].map(([field, label]) => (
              <label key={field} className="text-sm font-medium">
                {label}
                <input
                  type="color"
                  value={activeTheme[field] || '#000000'}
                  onChange={event => updateField(field, event.target.value)}
                  className="theme-input mt-1 h-12 w-full rounded-2xl px-2 py-2"
                />
              </label>
            ))}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-medium">
              Fuente de cuerpo
              <select
                value={activeTheme.fontBody || 'Inter'}
                onChange={event => updateField('fontBody', event.target.value)}
                className="theme-input mt-1 w-full rounded-2xl px-3 py-2.5"
              >
                {FONT_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Fuente de titulos
              <select
                value={activeTheme.fontHeading || 'Playfair Display'}
                onChange={event => updateField('fontHeading', event.target.value)}
                className="theme-input mt-1 w-full rounded-2xl px-3 py-2.5"
              >
                {FONT_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Estilo de boton
              <select
                value={activeTheme.buttonStyle || 'rounded'}
                onChange={event => updateField('buttonStyle', event.target.value)}
                className="theme-input mt-1 w-full rounded-2xl px-3 py-2.5"
              >
                {BUTTON_STYLE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Estilo de panel
              <select
                value={activeTheme.panelStyle || 'soft'}
                onChange={event => updateField('panelStyle', event.target.value)}
                className="theme-input mt-1 w-full rounded-2xl px-3 py-2.5"
              >
                {PANEL_STYLE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Estilo de formulario
              <select
                value={activeTheme.formStyle || 'filled'}
                onChange={event => updateField('formStyle', event.target.value)}
                className="theme-input mt-1 w-full rounded-2xl px-3 py-2.5"
              >
                {FORM_STYLE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={savingScope === activeScope}
            className="theme-button-primary mt-8 rounded-2xl px-5 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {savingScope === activeScope ? 'Guardando...' : 'Guardar tema'}
          </button>
        </article>

        <aside className="theme-panel rounded-[28px] p-8">
          <h3 className="text-xl font-semibold">Preview</h3>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted-color)' }}>
            Vista rápida del tono general de la superficie seleccionada.
          </p>

          <div className="mt-6 rounded-[28px] border p-6 shadow-brand-sm" style={previewStyle}>
            <p
              className="text-xs uppercase tracking-[0.25em]"
              style={{ color: activeTheme.mutedColor }}
            >
              {activeTheme.label || activeScope}
            </p>
            <h4
              className="mt-3 text-2xl font-semibold"
              style={{ color: activeTheme.headingColor, fontFamily: activeTheme.fontHeading }}
            >
              Panel con tema separado
            </h4>
            <p className="mt-3 text-sm" style={{ color: activeTheme.mutedColor }}>
              Cliente, admin y superadmin ya no tienen que compartir la misma identidad visual.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: activeTheme.primaryColor,
                  color: activeTheme.headingColor,
                  borderRadius: activeTheme.buttonStyle === 'pill' ? 999 : activeTheme.buttonStyle === 'sharp' ? 10 : 18
                }}
              >
                Accion principal
              </button>
              <button
                type="button"
                className="border px-4 py-2 text-sm font-semibold"
                style={{
                  borderColor: activeTheme.primaryColor,
                  color: activeTheme.textColor,
                  borderRadius: activeTheme.buttonStyle === 'pill' ? 999 : activeTheme.buttonStyle === 'sharp' ? 10 : 18
                }}
              >
                Secundario
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ThemeSettingsPage;
