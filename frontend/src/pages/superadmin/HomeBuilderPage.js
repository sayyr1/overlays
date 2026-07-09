import React, { useEffect, useMemo, useState } from 'react';
import {
  getSuperAdminHomeLayout,
  updateSuperAdminHomeLayout
} from '../../api/superAdmin';
import { usePublicConfig } from '../../context/PublicConfigContext';
import {
  createDefaultHomeSections,
  createHomeSection,
  getHomeSectionMeta,
  HOME_SECTION_LIBRARY,
  normalizeHomeSections,
  sortHomeSections,
  withSequentialHomeOrder
} from '../../utils/homeLayout';

const cloneValue = value => JSON.parse(JSON.stringify(value));

const serializeSections = sections =>
  JSON.stringify(sortHomeSections(sections).map(section => ({ ...section })));

const reorderById = (items, draggedId, targetId) => {
  const ordered = sortHomeSections(items);
  const fromIndex = ordered.findIndex(item => item.id === draggedId);
  const toIndex = ordered.findIndex(item => item.id === targetId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return ordered;
  }

  const next = [...ordered];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return withSequentialHomeOrder(next);
};

const statusPill = enabled =>
  enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200';

const HomeBuilderPage = () => {
  const [sections, setSections] = useState([]);
  const [savedSnapshot, setSavedSnapshot] = useState([]);
  const [removedSections, setRemovedSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [dragState, setDragState] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setPublicHomeLayout, reloadSection } = usePublicConfig();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await getSuperAdminHomeLayout();
        const nextSections = normalizeHomeSections(data?.sections);
        setSections(nextSections);
        setSavedSnapshot(cloneValue(nextSections));
        setRemovedSections([]);
        setSelectedSectionId(nextSections[0]?.id || '');
      } catch (error) {
        const fallback = createDefaultHomeSections();
        setSections(fallback);
        setSavedSnapshot(cloneValue(fallback));
        setSelectedSectionId(fallback[0]?.id || '');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const selectedSection = useMemo(
    () => sections.find(section => section.id === selectedSectionId) || null,
    [sections, selectedSectionId]
  );

  const hasPendingChanges = useMemo(
    () => serializeSections(sections) !== serializeSections(savedSnapshot) || removedSections.length > 0,
    [sections, savedSnapshot, removedSections]
  );

  const updateSelectedSection = updater => {
    setSections(prev =>
      prev.map(section => (section.id === selectedSectionId ? updater(section) : section))
    );
  };

  const handleAddSection = type => {
    const nextSection = createHomeSection(type, {
      order: sections.length
    });
    if (!nextSection) {
      return;
    }

    const nextSections = withSequentialHomeOrder([...sections, nextSection]);
    setSections(nextSections);
    setSelectedSectionId(nextSection.id);
  };

  const handleDuplicateSection = sectionId => {
    const source = sections.find(section => section.id === sectionId);
    if (!source) {
      return;
    }

    const nextSection = createHomeSection(source.type, {
      ...cloneValue(source),
      id: undefined,
      order: sections.length,
      enabled: source.enabled
    });

    const nextSections = withSequentialHomeOrder([...sections, nextSection]);
    setSections(nextSections);
    setSelectedSectionId(nextSection.id);
  };

  const handleArchiveSection = sectionId => {
    const target = sections.find(section => section.id === sectionId);
    if (!target) {
      return;
    }

    const nextSections = sections.filter(section => section.id !== sectionId);
    setRemovedSections(prev => [...prev, cloneValue(target)]);
    setSections(withSequentialHomeOrder(nextSections));
    setSelectedSectionId(nextSections[0]?.id || '');
  };

  const handleRestoreSection = sectionId => {
    const target = removedSections.find(section => section.id === sectionId);
    if (!target) {
      return;
    }

    const nextSections = withSequentialHomeOrder([
      ...sections,
      {
        ...cloneValue(target),
        order: sections.length
      }
    ]);

    setSections(nextSections);
    setRemovedSections(prev => prev.filter(section => section.id !== sectionId));
    setSelectedSectionId(target.id);
  };

  const handleResetDefaults = () => {
    if (!window.confirm('Restaurar la estructura base del home?')) {
      return;
    }

    const defaults = createDefaultHomeSections();
    setSections(defaults);
    setRemovedSections([]);
    setSelectedSectionId(defaults[0]?.id || '');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        sections: withSequentialHomeOrder(sections)
      };
      const { data } = await updateSuperAdminHomeLayout(payload);
      const nextSections = normalizeHomeSections(data?.sections);
      setSections(nextSections);
      setSavedSnapshot(cloneValue(nextSections));
      setRemovedSections([]);
      setPublicHomeLayout({ sections: nextSections });
      await reloadSection('homeLayout');
      window.alert('Home actualizado.');
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No se pudo guardar el home.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <section className="theme-panel rounded-3xl p-8">Cargando Home Builder...</section>;
  }

  return (
    <section className="space-y-6">
      <div className="theme-panel rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Home Builder</h2>
            <p className="mt-2 max-w-3xl text-sm" style={{ color: 'var(--muted-color)' }}>
              Habilita, bloquea, reordena y crea bloques del home publico sin tocar codigo. Puedes duplicar una seccion para repetirla con otro enfoque.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="theme-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold"
            >
              Restaurar base
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasPendingChanges}
              className="theme-button-primary rounded-2xl px-5 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar home'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="theme-panel rounded-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Biblioteca de secciones</h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted-color)' }}>
                  Agrega nuevas instancias al home. Las secciones no se publican hasta guardar.
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-slate-700">
                {sections.length} bloques activos
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {Object.values(HOME_SECTION_LIBRARY).map(item => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleAddSection(item.type)}
                  className="rounded-2xl border border-surface-200 bg-white p-4 text-left transition hover:border-brand hover:bg-brand/5"
                >
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="theme-panel rounded-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Orden del home</h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted-color)' }}>
                  Arrastra para cambiar el orden o selecciona una tarjeta para editarla.
                </p>
              </div>
              {hasPendingChanges ? (
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                  Cambios sin guardar
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Sin cambios
                </span>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {sortHomeSections(sections).map(section => {
                const meta = getHomeSectionMeta(section.type);
                const isSelected = selectedSectionId === section.id;
                const isDropTarget = dropTarget === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    draggable
                    onDragStart={() => {
                      setDragState(section.id);
                      setDropTarget(section.id);
                    }}
                    onDragOver={event => {
                      event.preventDefault();
                      setDropTarget(section.id);
                    }}
                    onDrop={event => {
                      event.preventDefault();
                      setSections(prev => reorderById(prev, dragState, section.id));
                      setDragState(null);
                      setDropTarget(null);
                    }}
                    onDragEnd={() => {
                      setDragState(null);
                      setDropTarget(null);
                    }}
                    onClick={() => setSelectedSectionId(section.id)}
                    className={`block w-full rounded-[28px] border p-5 text-left transition ${
                      isSelected ? 'border-brand ring-2 ring-brand/20' : 'border-surface-200 bg-white'
                    } ${isDropTarget && dragState && dragState !== section.id ? 'border-brand bg-brand/5' : ''}`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-surface-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-600">
                            {String(meta?.label || section.type)}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusPill(section.enabled)}`}>
                            {section.enabled ? 'Visible' : 'Oculta'}
                          </span>
                        </div>
                        <p className="mt-3 text-lg font-semibold text-slate-900">
                          {section.title || section.settings?.title || meta?.label}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {meta?.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            setSections(prev =>
                              prev.map(item =>
                                item.id === section.id ? { ...item, enabled: !item.enabled } : item
                              )
                            );
                          }}
                          className="theme-button-secondary rounded-xl px-3 py-2 text-xs font-semibold"
                        >
                          {section.enabled ? 'Bloquear' : 'Habilitar'}
                        </button>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            handleDuplicateSection(section.id);
                          }}
                          className="theme-button-secondary rounded-xl px-3 py-2 text-xs font-semibold"
                        >
                          Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            handleArchiveSection(section.id);
                          }}
                          className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {removedSections.length ? (
              <div className="mt-5 rounded-2xl border border-surface-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Papelera temporal</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {removedSections.map(section => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleRestoreSection(section.id)}
                      className="rounded-full border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                    >
                      Restaurar {section.title || getHomeSectionMeta(section.type)?.label || section.type}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="theme-panel rounded-3xl p-6">
            <h3 className="text-lg font-semibold">Editor de bloque</h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted-color)' }}>
              Ajusta textos, CTA, links y limites visibles del bloque seleccionado.
            </p>

            {!selectedSection ? (
              <div className="mt-5 rounded-2xl border border-dashed border-surface-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                Selecciona una seccion para editarla.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Titulo
                    <input
                      value={selectedSection.title || ''}
                      onChange={event => updateSelectedSection(section => ({ ...section, title: event.target.value }))}
                      className="theme-input mt-1 w-full rounded-xl px-3 py-2"
                      placeholder="Opcional"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Eyebrow
                    <input
                      value={selectedSection.eyebrow || ''}
                      onChange={event => updateSelectedSection(section => ({ ...section, eyebrow: event.target.value }))}
                      className="theme-input mt-1 w-full rounded-xl px-3 py-2"
                      placeholder="Texto corto superior"
                    />
                  </label>
                </div>

                {getHomeSectionMeta(selectedSection.type)?.supportsLimit ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">
                      Link destino
                      <input
                        value={selectedSection.linkTo || ''}
                        onChange={event => updateSelectedSection(section => ({ ...section, linkTo: event.target.value }))}
                        className="theme-input mt-1 w-full rounded-xl px-3 py-2"
                        placeholder="/ruta"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Texto del link
                      <input
                        value={selectedSection.linkLabel || ''}
                        onChange={event => updateSelectedSection(section => ({ ...section, linkLabel: event.target.value }))}
                        className="theme-input mt-1 w-full rounded-xl px-3 py-2"
                        placeholder="Ver mas"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700 md:col-span-2">
                      Limite de items
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={selectedSection.limit || 6}
                        onChange={event =>
                          updateSelectedSection(section => ({
                            ...section,
                            limit: Math.max(1, Math.min(24, Number(event.target.value || 1)))
                          }))
                        }
                        className="theme-input mt-1 w-full rounded-xl px-3 py-2"
                      />
                    </label>
                  </div>
                ) : null}

                {selectedSection.type === 'hero' ? (
                  <div className="space-y-4 rounded-2xl border border-surface-200 bg-slate-50 p-4">
                    <div className="grid gap-4">
                      <label className="text-sm font-medium text-slate-700">
                        Badge / eyebrow hero
                        <input
                          value={selectedSection.settings?.eyebrow || ''}
                          onChange={event =>
                            updateSelectedSection(section => ({
                              ...section,
                              settings: {
                                ...(section.settings || {}),
                                eyebrow: event.target.value
                              }
                            }))
                          }
                          className="theme-input mt-1 w-full rounded-xl px-3 py-2"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Titulo hero
                        <textarea
                          value={selectedSection.settings?.title || ''}
                          onChange={event =>
                            updateSelectedSection(section => ({
                              ...section,
                              settings: {
                                ...(section.settings || {}),
                                title: event.target.value
                              }
                            }))
                          }
                          rows={3}
                          className="theme-input mt-1 w-full rounded-xl px-3 py-2"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Descripcion hero
                        <textarea
                          value={selectedSection.settings?.description || ''}
                          onChange={event =>
                            updateSelectedSection(section => ({
                              ...section,
                              settings: {
                                ...(section.settings || {}),
                                description: event.target.value
                              }
                            }))
                          }
                          rows={4}
                          className="theme-input mt-1 w-full rounded-xl px-3 py-2"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-medium text-slate-700">
                        CTA principal
                        <input
                          value={selectedSection.settings?.primaryCtaLabel || ''}
                          onChange={event =>
                            updateSelectedSection(section => ({
                              ...section,
                              settings: {
                                ...(section.settings || {}),
                                primaryCtaLabel: event.target.value
                              }
                            }))
                          }
                          className="theme-input mt-1 w-full rounded-xl px-3 py-2"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        URL principal
                        <input
                          value={selectedSection.settings?.primaryCtaTo || ''}
                          onChange={event =>
                            updateSelectedSection(section => ({
                              ...section,
                              settings: {
                                ...(section.settings || {}),
                                primaryCtaTo: event.target.value
                              }
                            }))
                          }
                          className="theme-input mt-1 w-full rounded-xl px-3 py-2"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        CTA secundario
                        <input
                          value={selectedSection.settings?.secondaryCtaLabel || ''}
                          onChange={event =>
                            updateSelectedSection(section => ({
                              ...section,
                              settings: {
                                ...(section.settings || {}),
                                secondaryCtaLabel: event.target.value
                              }
                            }))
                          }
                          className="theme-input mt-1 w-full rounded-xl px-3 py-2"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        URL secundaria
                        <input
                          value={selectedSection.settings?.secondaryCtaTo || ''}
                          onChange={event =>
                            updateSelectedSection(section => ({
                              ...section,
                              settings: {
                                ...(section.settings || {}),
                                secondaryCtaTo: event.target.value
                              }
                            }))
                          }
                          className="theme-input mt-1 w-full rounded-xl px-3 py-2"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="theme-panel rounded-3xl p-6">
            <h3 className="text-lg font-semibold">Impacto rapido</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Visibles</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {sections.filter(section => section.enabled).length}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ocultas</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {sections.filter(section => !section.enabled).length}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Papelera</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {removedSections.length}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default HomeBuilderPage;
