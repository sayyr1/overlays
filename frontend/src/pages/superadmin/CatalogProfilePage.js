import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applySuperAdminCatalogProfile,
  getSuperAdminCatalogProfiles,
  getSuperAdminSettings
} from '../../api/superAdmin';
import { usePublicConfig } from '../../context/PublicConfigContext';

const MODE_OPTIONS = [
  {
    value: 'merge',
    label: 'Fusionar recomendado',
    description: 'Agrega categorias y mapeos sugeridos sin borrar lo que ya existe.'
  },
  {
    value: 'replace',
    label: 'Reemplazar taxonomia',
    description: 'Reemplaza categorias, tallas y mapeos por la estructura del preset.'
  },
  {
    value: 'reset',
    label: 'Limpiar y aplicar',
    description: 'Limpia la taxonomia actual y deja solo la base del preset seleccionado.'
  }
];

const FALLBACK_PRESETS = [
  {
    key: 'footwear',
    label: 'Zapatos',
    description: 'Preset recomendado para calzado, sneakers y sandalias.',
    recommendedFor: ['Zapaterias', 'Sneakers', 'Calzado casual'],
    categoryKeys: ['brand', 'collection', 'color', 'gender', 'size', 'type'],
    sizePreview: ['35', '36', '37', '38', '39', '40', '41', '42'],
    sampleBrands: ['Nike', 'Adidas', 'Puma', 'New Balance'],
    totalBrandModels: 12
  },
  {
    key: 'apparel',
    label: 'Ropa',
    description: 'Preset recomendado para ropa, moda y colecciones textiles.',
    recommendedFor: ['Boutiques', 'Streetwear', 'Moda casual'],
    categoryKeys: ['brand', 'collection', 'color', 'gender', 'material', 'season', 'size', 'type'],
    sizePreview: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    sampleBrands: ['Zara', 'Nike', 'Adidas', "Levi's"],
    totalBrandModels: 12
  },
  {
    key: 'custom',
    label: 'Base limpia',
    description: 'Arranque neutro para construir la taxonomia desde cero.',
    recommendedFor: ['Catalogos mixtos', 'Tiendas especializadas', 'Implementaciones a medida'],
    categoryKeys: ['brand', 'collection', 'color', 'gender', 'size', 'type'],
    sizePreview: [],
    sampleBrands: [],
    totalBrandModels: 0
  }
];

const FALLBACK_PRESET_MAP = FALLBACK_PRESETS.reduce((acc, preset) => {
  acc[preset.key] = preset;
  return acc;
}, {});

const EMPTY_STATS = {
  totalKeys: 0,
  totalValues: 0,
  customKeys: 0,
  customKeyNames: [],
  totalBrandModels: 0
};

const isValidCatalogProfilesPayload = payload =>
  Boolean(
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    Array.isArray(payload.presets) &&
    payload.presets.length > 0
  );

const buildFallbackPayload = settings => {
  const profileKey = String(settings?.catalogProfile || 'footwear').trim() || 'footwear';
  const profileMeta = FALLBACK_PRESET_MAP[profileKey] || FALLBACK_PRESET_MAP.footwear;

  return {
    currentProfile: {
      key: profileKey,
      label: settings?.catalogProfileLabel || profileMeta.label
    },
    stats: { ...EMPTY_STATS },
    presets: FALLBACK_PRESETS
  };
};

const normalizePayload = (payload, settings) => {
  const fallback = buildFallbackPayload(settings);
  if (!isValidCatalogProfilesPayload(payload)) {
    return fallback;
  }

  return {
    currentProfile: {
      key: payload?.currentProfile?.key || fallback.currentProfile.key,
      label: payload?.currentProfile?.label || fallback.currentProfile.label
    },
    stats: {
      ...EMPTY_STATS,
      ...(payload?.stats || {})
    },
    presets: payload.presets
  };
};

const CatalogProfilePage = () => {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [selectedPresetKey, setSelectedPresetKey] = useState('footwear');
  const [mode, setMode] = useState('merge');
  const [applying, setApplying] = useState(false);
  const { settings, setPublicSettings, reloadSection } = usePublicConfig();

  const loadProfiles = useCallback(async () => {
    try {
      setError('');
      const [{ data: profilesData }, { data: settingsData }] = await Promise.all([
        getSuperAdminCatalogProfiles(),
        getSuperAdminSettings()
      ]);
      const normalized = normalizePayload(profilesData, settingsData);
      if (!isValidCatalogProfilesPayload(profilesData)) {
        setError('La respuesta del perfil de catalogo llego incompleta. Se cargaron presets base para continuar.');
      }
      setPayload(normalized);
      setSelectedPresetKey(normalized.currentProfile?.key || 'footwear');
    } catch (loadError) {
      const fallback = buildFallbackPayload(settings);
      setPayload(fallback);
      setSelectedPresetKey(fallback.currentProfile?.key || 'footwear');
      setError(loadError?.response?.data?.message || 'No se pudieron cargar los perfiles de catalogo.');
    }
  }, [settings]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    if (selectedPresetKey === 'custom' && mode === 'merge') {
      setMode('reset');
    }
  }, [mode, selectedPresetKey]);

  const selectedPreset = useMemo(
    () => payload?.presets?.find(item => item.key === selectedPresetKey) || null,
    [payload, selectedPresetKey]
  );
  const presets = Array.isArray(payload?.presets) ? payload.presets : [];
  const stats = payload?.stats || {};
  const customKeyNames = Array.isArray(stats.customKeyNames) ? stats.customKeyNames : [];

  if (!payload) {
    return <section className="theme-panel rounded-3xl p-8">Cargando perfiles de catalogo...</section>;
  }

  const handleApply = async () => {
    if (!selectedPreset) return;

    const confirmMessage = {
      merge: `Fusionar el preset "${selectedPreset.label}" con la taxonomia actual?`,
      replace: `Reemplazar la taxonomia actual por "${selectedPreset.label}"?`,
      reset: `Limpiar la taxonomia actual y aplicar "${selectedPreset.label}"?`
    }[mode];

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setApplying(true);

    try {
      const { data } = await applySuperAdminCatalogProfile({
        presetKey: selectedPreset.key,
        mode
      });
      if (data?.settings) {
        setPublicSettings(data.settings);
      }
      setPayload(prev => ({
        ...(prev || buildFallbackPayload(data?.settings || settings)),
        currentProfile: {
          key: data?.preset?.key || data?.settings?.catalogProfile || selectedPreset.key,
          label: data?.preset?.label || data?.settings?.catalogProfileLabel || selectedPreset.label
        },
        stats: {
          ...EMPTY_STATS,
          ...(data?.stats || prev?.stats || {})
        }
      }));
      await reloadSection('settings');
      await loadProfiles();
      window.alert('Perfil de catalogo aplicado.');
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No se pudo aplicar el perfil de catalogo.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="theme-panel rounded-3xl p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Perfil de catalogo</h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--muted-color)' }}>
              Define si esta tienda arranca recomendada para zapatos, ropa o una base limpia.
              Esto ajusta categorias, tallas y el mapa marca - modelo sin tocar pedidos.
            </p>
          </div>
          <div className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Activo ahora</p>
            <p className="mt-1">{payload.currentProfile?.label || 'Sin perfil'}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {presets.map(preset => {
            const isActive = selectedPresetKey === preset.key;
            const isCurrent = payload.currentProfile?.key === preset.key;

            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => setSelectedPresetKey(preset.key)}
                className={`theme-panel block w-full rounded-[28px] p-6 text-left transition ${
                  isActive ? 'border-brand ring-2 ring-brand/20' : ''
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold">{preset.label}</h3>
                      {isCurrent && (
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                          activo
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm" style={{ color: 'var(--muted-color)' }}>
                      {preset.description}
                    </p>
                  </div>
                  <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                    {preset.totalBrandModels} mapeos
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {preset.recommendedFor?.map(item => (
                    <span key={item} className="rounded-full border border-surface-200 bg-white px-3 py-1 font-semibold text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-surface-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Claves</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{(preset.categoryKeys || []).join(', ')}</p>
                  </div>
                  <div className="rounded-2xl border border-surface-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tallas</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{(preset.sizePreview || []).join(', ') || 'Sin sugerencia'}</p>
                  </div>
                  <div className="rounded-2xl border border-surface-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Marcas</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{(preset.sampleBrands || []).join(', ') || 'Base limpia'}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <aside className="space-y-6">
          <div className="theme-panel rounded-[28px] p-6">
            <h3 className="text-lg font-semibold">Aplicar preset</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--muted-color)' }}>
              Selecciona el modo segun qué tan agresivo quieres que sea el cambio.
            </p>

            {selectedPresetKey === 'custom' && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Base limpia vacia la taxonomia actual. Si estaba en fusionar, se cambia automaticamente a limpiar y aplicar.
              </div>
            )}

            <div className="mt-4 space-y-3">
              {MODE_OPTIONS.map(option => (
                <label
                  key={option.value}
                  className={`block rounded-2xl border p-4 transition ${
                    mode === option.value ? 'border-brand bg-brand/5' : 'border-surface-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="catalog-profile-mode"
                      value={option.value}
                      checked={mode === option.value}
                      onChange={event => setMode(event.target.value)}
                      disabled={selectedPresetKey === 'custom' && option.value === 'merge'}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                      <p className="mt-1 text-sm text-slate-600">{option.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleApply}
              disabled={applying || !selectedPreset}
              className="theme-button-primary mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {applying ? 'Aplicando...' : `Aplicar ${selectedPreset?.label || 'preset'}`}
            </button>
          </div>

          <div className="theme-panel-subtle rounded-[28px] p-6">
            <h3 className="text-base font-semibold">Estado actual</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Claves</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.totalKeys || 0}</p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Valores</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.totalValues || 0}</p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Claves custom</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.customKeys || 0}</p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Brand-model</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.totalBrandModels || 0}</p>
              </div>
            </div>

            {customKeyNames.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Claves personalizadas
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {customKeyNames.map(key => (
                    <span key={key} className="rounded-full border border-surface-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default CatalogProfilePage;
