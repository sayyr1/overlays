import React, { useEffect, useMemo, useState } from 'react';
import {
  createSuperAdminForm,
  deleteSuperAdminForm,
  getSuperAdminForms,
  updateSuperAdminForm
} from '../../api/superAdmin';
import DynamicFormRenderer from '../../components/forms/DynamicFormRenderer';

const FIELD_TYPE_OPTIONS = ['text', 'email', 'phone', 'textarea', 'select', 'radio', 'checkbox', 'number', 'date'];
const WIDTH_OPTIONS = ['full', 'half', 'third'];
const LAYOUT_OPTIONS = ['grid', 'stacked'];
const SCOPE_OPTIONS = ['storefront', 'admin', 'superadmin'];

const createId = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `tmp-${Date.now()}-${Math.random()}`);
const getFieldId = field => field?.id || field?._id;
const normalizeKey = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
const sortByOrder = items => [...(Array.isArray(items) ? items : [])].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
const withSequentialOrder = items => items.map((item, index) => ({ ...item, order: index }));
const reorderById = (items, draggedId, targetId) => {
  const ordered = sortByOrder(items);
  const fromIndex = ordered.findIndex(item => item.id === draggedId || item._id === draggedId);
  const toIndex = ordered.findIndex(item => item.id === targetId || item._id === targetId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return ordered;
  }

  const next = [...ordered];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return withSequentialOrder(next);
};

const cloneValue = value => JSON.parse(JSON.stringify(value));

const createEmptyField = () => ({
  id: createId(),
  name: '',
  label: 'Nuevo campo',
  type: 'text',
  required: false,
  enabled: true,
  locked: false,
  placeholder: '',
  helpText: '',
  defaultValue: '',
  width: 'full',
  order: 0,
  options: [],
  settings: {}
});

const createEmptyFormDraft = () => ({
  title: '',
  key: '',
  description: '',
  scope: 'storefront'
});

const normalizeForm = form => ({
  ...form,
  _lookupKey: form._lookupKey || form.key,
  fields: sortByOrder(form.fields || [])
});

const hydrateForms = forms => sortByOrder(cloneValue(Array.isArray(forms) ? forms : []).map(normalizeForm));

const serializeForms = forms =>
  JSON.stringify(
    sortByOrder(forms).map(form => ({
      ...form,
      fields: sortByOrder(form.fields || []).map(field => ({ ...field }))
    }))
  );

const optionsToTextarea = options =>
  (Array.isArray(options) ? options : [])
    .map(option => `${option.label}|${option.value}`)
    .join('\n');

const textareaToOptions = value =>
  String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [labelPart, valuePart] = line.split('|');
      const label = String(labelPart || '').trim();
      const nextValue = String(valuePart || label).trim();
      if (!label || !nextValue) return null;
      return { label, value: nextValue };
    })
    .filter(Boolean);

const statusPillClassName = enabled =>
  enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200';
const editorLabelClassName = 'text-[15px] font-semibold leading-6';
const editorInputClassName = 'mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-[15px] leading-6 text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
const sectionHintStyle = { color: 'var(--muted-color)' };
const fieldMetaPillClassName = 'rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600';

const FormBuilderPage = () => {
  const [forms, setForms] = useState([]);
  const [savedFormsSnapshot, setSavedFormsSnapshot] = useState([]);
  const [pendingDeletedForms, setPendingDeletedForms] = useState([]);
  const [removedFieldsByFormId, setRemovedFieldsByFormId] = useState({});
  const [selectedFormId, setSelectedFormId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState(createEmptyFormDraft());
  const [dragState, setDragState] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [expandedFieldId, setExpandedFieldId] = useState('');

  const loadForms = async () => {
    setLoading(true);
    try {
      const { data } = await getSuperAdminForms();
      const nextForms = hydrateForms(data);
      setForms(nextForms);
      setSavedFormsSnapshot(cloneValue(nextForms));
      setPendingDeletedForms([]);
      setRemovedFieldsByFormId({});
      setSelectedFormId(current => current || nextForms[0]?._id || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, []);

  const selectedForm = useMemo(
    () => forms.find(item => item._id === selectedFormId) || null,
    [forms, selectedFormId]
  );

  const selectedSavedForm = useMemo(
    () => savedFormsSnapshot.find(item => item._id === selectedFormId) || null,
    [savedFormsSnapshot, selectedFormId]
  );

  const removedFields = removedFieldsByFormId[selectedFormId] || [];

  const hasPendingChanges = useMemo(
    () => serializeForms(forms) !== serializeForms(savedFormsSnapshot) || pendingDeletedForms.length > 0,
    [forms, savedFormsSnapshot, pendingDeletedForms]
  );

  useEffect(() => {
    const fields = sortByOrder(selectedForm?.fields || []);
    if (!fields.length) {
      setExpandedFieldId('');
      return;
    }

    const stillExists = fields.some(field => getFieldId(field) === expandedFieldId);
    if (!stillExists) {
      setExpandedFieldId(getFieldId(fields[0]));
    }
  }, [selectedForm, expandedFieldId]);

  const updateSelectedForm = updater => {
    setForms(prev =>
      prev.map(item => (item._id === selectedFormId ? normalizeForm(updater(item)) : item))
    );
  };

  const handleCreateForm = async event => {
    event.preventDefault();
    setCreating(true);

    try {
      const payload = {
        ...newForm,
        key: normalizeKey(newForm.key || newForm.title),
        enabled: true,
        submitLabel: 'Enviar',
        successMessage: 'Formulario configurado correctamente.',
        layout: 'grid',
        order: forms.length,
        fields: [
          {
            ...createEmptyField(),
            name: 'name',
            label: 'Nombre',
            required: true
          }
        ]
      };
      const { data } = await createSuperAdminForm(payload);
      const nextForm = normalizeForm(data);
      const nextForms = sortByOrder([...forms, nextForm]);
      const nextSnapshot = sortByOrder([...savedFormsSnapshot, nextForm]);
      setForms(nextForms);
      setSavedFormsSnapshot(cloneValue(nextSnapshot));
      setSelectedFormId(nextForm._id);
      setNewForm(createEmptyFormDraft());
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No se pudo crear el formulario.');
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!forms.length && !pendingDeletedForms.length) return;
    setSaving(true);

    try {
      let nextForms = [...forms];

      for (const currentForm of sortByOrder(forms)) {
        const { data } = await updateSuperAdminForm(currentForm._lookupKey || currentForm.key, {
          ...currentForm,
          fields: withSequentialOrder(sortByOrder(currentForm.fields || []))
        });
        const normalized = normalizeForm(data);
        nextForms = nextForms.map(item => (item._id === normalized._id ? normalized : item));
      }

      for (const deletedForm of pendingDeletedForms) {
        await deleteSuperAdminForm(deletedForm._lookupKey || deletedForm.key);
      }

      const hydratedNextForms = hydrateForms(nextForms);
      setForms(hydratedNextForms);
      setSavedFormsSnapshot(cloneValue(hydratedNextForms));
      setPendingDeletedForms([]);
      setRemovedFieldsByFormId({});
      setSelectedFormId(current => current || hydratedNextForms[0]?._id || '');
      window.alert('Cambios guardados.');
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No se pudieron guardar los formularios.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveForm = () => {
    if (!selectedForm) return;
    if (!window.confirm(`Mover "${selectedForm.title}" a la papelera temporal?`)) return;

    const nextForms = forms.filter(item => item._id !== selectedForm._id);
    setPendingDeletedForms(prev => [...prev, cloneValue(selectedForm)]);
    setForms(nextForms);
    setSelectedFormId(nextForms[0]?._id || '');
  };

  const restoreArchivedForm = formId => {
    const restoredForm = pendingDeletedForms.find(item => item._id === formId);
    if (!restoredForm) return;

    const nextForms = sortByOrder([...forms, normalizeForm(cloneValue(restoredForm))]);
    setForms(nextForms);
    setPendingDeletedForms(prev => prev.filter(item => item._id !== formId));
    setSelectedFormId(restoredForm._id);
  };

  const addField = () => {
    const nextField = {
      ...createEmptyField(),
      order: (selectedForm?.fields || []).length
    };

    updateSelectedForm(form => ({
      ...form,
      fields: withSequentialOrder([
        ...sortByOrder(form.fields || []),
        nextField
      ])
    }));
    setExpandedFieldId(nextField.id);
  };

  const updateField = (fieldId, changes) => {
    updateSelectedForm(form => ({
      ...form,
      fields: form.fields.map(field =>
        getFieldId(field) === fieldId
          ? {
            ...field,
            ...changes
          }
          : field
      )
    }));
  };

  const duplicateField = fieldId => {
    const duplicatedFieldId = createId();

    updateSelectedForm(form => {
      const target = form.fields.find(field => getFieldId(field) === fieldId);
      if (!target) return form;

      return {
        ...form,
        fields: withSequentialOrder([
          ...sortByOrder(form.fields || []),
          {
            ...target,
            id: duplicatedFieldId,
            name: normalizeKey(`${target.name || 'field'}_${(form.fields || []).length + 1}`),
            label: `${target.label} copia`
          }
        ])
      };
    });
    setExpandedFieldId(duplicatedFieldId);
  };

  const removeField = fieldId => {
    if (!selectedForm) return;
    const fieldToRemove = selectedForm.fields.find(field => getFieldId(field) === fieldId);
    if (!fieldToRemove) return;

    setRemovedFieldsByFormId(prev => ({
      ...prev,
      [selectedForm._id]: [...(prev[selectedForm._id] || []), cloneValue(fieldToRemove)]
    }));

    updateSelectedForm(form => ({
      ...form,
      fields: withSequentialOrder(form.fields.filter(field => getFieldId(field) !== fieldId))
    }));
    if (expandedFieldId === fieldId) {
      setExpandedFieldId('');
    }
  };

  const restoreField = fieldId => {
    if (!selectedForm) return;
    const fieldToRestore = removedFields.find(field => getFieldId(field) === fieldId);
    if (!fieldToRestore) return;

    setRemovedFieldsByFormId(prev => ({
      ...prev,
      [selectedForm._id]: (prev[selectedForm._id] || []).filter(field => getFieldId(field) !== fieldId)
    }));

    updateSelectedForm(form => ({
      ...form,
      fields: withSequentialOrder([...sortByOrder(form.fields || []), cloneValue(fieldToRestore)])
    }));
    setExpandedFieldId(fieldId);
  };

  const restoreSelectedForm = () => {
    if (!selectedSavedForm) return;

    setForms(prev =>
      prev.map(item => (item._id === selectedFormId ? normalizeForm(cloneValue(selectedSavedForm)) : item))
    );
    setRemovedFieldsByFormId(prev => ({
      ...prev,
      [selectedFormId]: []
    }));
  };

  const restoreAll = () => {
    const restoredForms = hydrateForms(savedFormsSnapshot);
    setForms(restoredForms);
    setPendingDeletedForms([]);
    setRemovedFieldsByFormId({});
    setSelectedFormId(current =>
      restoredForms.some(item => item._id === current) ? current : restoredForms[0]?._id || ''
    );
  };

  const updateFormOrder = (draggedId, targetId) => {
    setForms(prev => reorderById(prev, draggedId, targetId));
  };

  const updateFieldOrder = (draggedId, targetId) => {
    updateSelectedForm(form => ({
      ...form,
      fields: reorderById(form.fields || [], draggedId, targetId)
    }));
  };

  const handleDragStart = payload => setDragState(payload);

  const handleDrop = payload => {
    if (!dragState) return;

    if (dragState.type === 'form' && payload.type === 'form') {
      updateFormOrder(dragState.id, payload.id);
    }

    if (dragState.type === 'field' && payload.type === 'field') {
      updateFieldOrder(dragState.id, payload.id);
    }

    setDragState(null);
    setDropTarget(null);
  };

  if (loading) {
    return <section className="theme-panel rounded-[28px] p-8">Cargando formularios...</section>;
  }

  return (
    <section className="space-y-6">
      <div className="theme-panel rounded-[28px] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold">Form Builder</h2>
            <p className="mt-2 max-w-3xl text-base leading-7" style={sectionHintStyle}>
              Configura formularios reutilizables para tienda, admin o superadmin. Ahora el borrado pasa por
              papelera temporal y puedes restaurar antes de guardar.
            </p>
          </div>
          <div className={`rounded-full px-3 py-2 text-xs font-semibold ${hasPendingChanges ? 'bg-amber-500/15 text-amber-200' : 'bg-emerald-500/15 text-emerald-300'}`}>
            {hasPendingChanges ? 'Cambios sin guardar' : 'Todo guardado'}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1.15fr)_360px]">
        <aside className="theme-panel rounded-[28px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Formularios</h3>
              <p className="mt-1 text-sm leading-6" style={sectionHintStyle}>
                Arrastra para ordenar y separa por scope.
              </p>
            </div>
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              {forms.length} activos
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {sortByOrder(forms).map(form => (
              <button
                key={form._id}
                type="button"
                draggable
                onDragStart={() => handleDragStart({ type: 'form', id: form._id })}
                onDragOver={event => {
                  event.preventDefault();
                  setDropTarget({ type: 'form', id: form._id });
                }}
                onDrop={() => handleDrop({ type: 'form', id: form._id })}
                onClick={() => setSelectedFormId(form._id)}
                className={`block w-full rounded-[22px] border px-4 py-3 text-left transition ${
                  selectedFormId === form._id
                    ? 'border-brand bg-brand/10 shadow-[0_12px_30px_rgba(0,0,0,0.08)]'
                    : dropTarget?.type === 'form' && dropTarget.id === form._id
                      ? 'border-brand/50 bg-brand/5'
                      : 'border-surface-200 bg-white/5 hover:border-brand/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{form.title}</p>
                    <p className="mt-1 truncate text-xs uppercase tracking-[0.18em]" style={sectionHintStyle}>
                      {form.scope} | {form.key}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${statusPillClassName(form.enabled)}`}>
                    {form.enabled ? 'Activo' : 'Oculto'}
                  </span>
                </div>
                <p className="mt-3 text-sm" style={sectionHintStyle}>
                  {form.fields?.length || 0} campos
                </p>
              </button>
            ))}
          </div>

          {pendingDeletedForms.length > 0 && (
            <div className="theme-panel-subtle mt-6 rounded-[24px] border border-amber-300/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Papelera temporal</p>
                  <p className="mt-1 text-sm leading-6" style={sectionHintStyle}>
                    No se eliminan de verdad hasta guardar.
                  </p>
                </div>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                  {pendingDeletedForms.length}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {pendingDeletedForms.map(form => (
                  <div key={form._id} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300/20 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{form.title}</p>
                      <p className="truncate text-xs" style={sectionHintStyle}>
                        {form.scope} | {form.key}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreArchivedForm(form._id)}
                      className="theme-button-secondary rounded-2xl px-3 py-2 text-xs font-semibold"
                    >
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleCreateForm} className="theme-panel-subtle mt-6 rounded-[24px] p-4">
            <p className="text-sm font-semibold">Nuevo formulario</p>
            <div className="mt-3 space-y-3">
              <input
                value={newForm.title}
                onChange={event => setNewForm(prev => ({ ...prev, title: event.target.value }))}
                placeholder="Titulo"
                className="theme-input w-full rounded-2xl px-3 py-2.5 text-sm"
              />
              <input
                value={newForm.key}
                onChange={event => setNewForm(prev => ({ ...prev, key: normalizeKey(event.target.value) }))}
                placeholder="clave_formulario"
                className="theme-input w-full rounded-2xl px-3 py-2.5 text-sm"
              />
              <select
                value={newForm.scope}
                onChange={event => setNewForm(prev => ({ ...prev, scope: event.target.value }))}
                className="theme-input w-full rounded-2xl px-3 py-2.5 text-sm"
              >
                {SCOPE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={creating}
                className="theme-button-primary w-full rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {creating ? 'Creando...' : 'Crear formulario'}
              </button>
            </div>
          </form>
        </aside>

        <article className="theme-panel rounded-[28px] p-6">
          {!selectedForm ? (
            <div className="rounded-[24px] border border-dashed border-surface-200 p-8 text-center text-sm" style={{ color: 'var(--muted-color)' }}>
              Selecciona un formulario para editarlo.
            </div>
          ) : (
            <>
              <div className="sticky top-4 z-10 mb-6 rounded-[24px] border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{selectedForm.title || 'Formulario sin titulo'}</p>
                    <p className="mt-1 text-sm uppercase tracking-[0.15em] text-slate-500">
                      {selectedForm.scope} | {selectedForm.key || 'sin_key'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addField}
                      className="theme-button-secondary rounded-2xl px-4 py-2.5 text-sm font-semibold"
                    >
                      Anadir campo
                    </button>
                    <button
                      type="button"
                      onClick={restoreSelectedForm}
                      disabled={!selectedSavedForm}
                      className="rounded-2xl border border-surface-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                      Restaurar formulario
                    </button>
                    <button
                      type="button"
                      onClick={restoreAll}
                      disabled={!hasPendingChanges}
                      className="rounded-2xl border border-surface-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                      Restaurar todo
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !hasPendingChanges}
                      className="theme-button-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button
                      type="button"
                      onClick={handleArchiveForm}
                      className="rounded-2xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-300"
                    >
                      Mover a papelera
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-slate-900 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-semibold">Configuracion base</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Define la metadata del formulario y si se muestra o no.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className={editorLabelClassName}>
                    Titulo
                    <input
                      value={selectedForm.title || ''}
                      onChange={event => updateSelectedForm(form => ({ ...form, title: event.target.value }))}
                      className={editorInputClassName}
                    />
                  </label>
                  <label className={editorLabelClassName}>
                    Key
                    <input
                      value={selectedForm.key || ''}
                      onChange={event => updateSelectedForm(form => ({ ...form, key: normalizeKey(event.target.value) }))}
                      className={editorInputClassName}
                    />
                  </label>
                  <label className={`${editorLabelClassName} md:col-span-2`}>
                    Descripcion
                    <textarea
                      value={selectedForm.description || ''}
                      onChange={event => updateSelectedForm(form => ({ ...form, description: event.target.value }))}
                      rows={2}
                      className={editorInputClassName}
                    />
                  </label>
                  <label className={editorLabelClassName}>
                    Scope
                    <select
                      value={selectedForm.scope || 'storefront'}
                      onChange={event => updateSelectedForm(form => ({ ...form, scope: event.target.value }))}
                      className={editorInputClassName}
                    >
                      {SCOPE_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className={editorLabelClassName}>
                    Layout
                    <select
                      value={selectedForm.layout || 'grid'}
                      onChange={event => updateSelectedForm(form => ({ ...form, layout: event.target.value }))}
                      className={editorInputClassName}
                    >
                      {LAYOUT_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className={editorLabelClassName}>
                    Boton
                    <input
                      value={selectedForm.submitLabel || ''}
                      onChange={event => updateSelectedForm(form => ({ ...form, submitLabel: event.target.value }))}
                      className={editorInputClassName}
                    />
                  </label>
                  <label className={editorLabelClassName}>
                    Orden
                    <input
                      type="number"
                      value={selectedForm.order ?? 0}
                      onChange={event => updateSelectedForm(form => ({ ...form, order: Number(event.target.value) || 0 }))}
                      className={editorInputClassName}
                    />
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-[15px] font-semibold leading-6 text-slate-900">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedForm.enabled)}
                      onChange={event => updateSelectedForm(form => ({ ...form, enabled: event.target.checked }))}
                    />
                    Formulario visible
                  </label>
                </div>
              </div>

              {removedFields.length > 0 && (
                <div className="mt-6 rounded-[24px] border border-amber-300/30 bg-amber-500/5 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">Campos en papelera</h3>
                      <p className="mt-1 text-sm leading-6" style={sectionHintStyle}>
                        Puedes restaurarlos antes de guardar.
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                      {removedFields.length} pendientes
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {removedFields.map(field => (
                      <div key={getFieldId(field)} className="flex items-center gap-3 rounded-2xl border border-amber-300/20 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{field.label || field.name || 'Campo'}</p>
                        <p className="text-xs text-slate-500">
                          {field.type} | {field.name || 'sin_name'}
                        </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => restoreField(getFieldId(field))}
                          className="theme-button-secondary rounded-2xl px-3 py-2 text-xs font-semibold"
                        >
                          Restaurar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Campos del formulario</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Solo un campo queda abierto a la vez para evitar scroll excesivo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedFieldId('')}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Contraer todos
                  </button>
                </div>

                <div className="space-y-4">
                {sortByOrder(selectedForm.fields || []).map((field, index) => (
                  (() => {
                    const fieldId = getFieldId(field);
                    const isExpanded = expandedFieldId === fieldId;
                    return (
                  <article
                    key={fieldId}
                    draggable
                    onDragStart={() => handleDragStart({ type: 'field', id: fieldId })}
                    onDragOver={event => {
                      event.preventDefault();
                      setDropTarget({ type: 'field', id: fieldId });
                    }}
                    onDrop={() => handleDrop({ type: 'field', id: fieldId })}
                    className={`rounded-[24px] border bg-white p-5 text-slate-900 shadow-sm transition ${
                      dropTarget?.type === 'field' && dropTarget.id === fieldId
                        ? 'border-brand bg-brand/5'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedFieldId(current => (current === fieldId ? '' : fieldId))}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">
                            Campo #{index + 1}: {field.label || 'Sin label'}
                          </p>
                          <span className={fieldMetaPillClassName}>{field.type || 'text'}</span>
                          <span className={fieldMetaPillClassName}>{field.width || 'full'}</span>
                          {field.required && <span className={fieldMetaPillClassName}>requerido</span>}
                          {field.enabled === false && <span className={fieldMetaPillClassName}>oculto</span>}
                          {field.locked && <span className={fieldMetaPillClassName}>bloqueado</span>}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {field.name || 'sin_name'} | Arrastra para cambiar posicion.
                        </p>
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedFieldId(current => (current === fieldId ? '' : fieldId))}
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          {isExpanded ? 'Cerrar' : 'Editar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateField(fieldId)}
                          className="theme-button-secondary rounded-2xl px-3 py-2 text-xs font-semibold"
                        >
                          Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(fieldId)}
                          className="rounded-2xl border border-red-300 px-3 py-2 text-xs font-semibold text-red-300"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_160px]">
                      <label className={editorLabelClassName}>
                        Label
                        <input
                          value={field.label || ''}
                          onChange={event => updateField(fieldId, { label: event.target.value })}
                          className={editorInputClassName}
                        />
                      </label>
                      <label className={editorLabelClassName}>
                        Name
                        <input
                          value={field.name || ''}
                          onChange={event => updateField(fieldId, { name: normalizeKey(event.target.value) })}
                          className={editorInputClassName}
                        />
                      </label>
                      <label className={editorLabelClassName}>
                        Tipo
                        <select
                          value={field.type || 'text'}
                          onChange={event => updateField(fieldId, { type: event.target.value, options: ['select', 'radio'].includes(event.target.value) ? field.options : [] })}
                          className={editorInputClassName}
                        >
                          {FIELD_TYPE_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                      <label className={editorLabelClassName}>
                        Width
                        <select
                          value={field.width || 'full'}
                          onChange={event => updateField(fieldId, { width: event.target.value })}
                          className={editorInputClassName}
                        >
                          {WIDTH_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className={editorLabelClassName}>
                        Placeholder
                        <input
                          value={field.placeholder || ''}
                          onChange={event => updateField(fieldId, { placeholder: event.target.value })}
                          className={editorInputClassName}
                        />
                      </label>
                      <label className={editorLabelClassName}>
                        Valor por defecto
                        <input
                          value={field.defaultValue || ''}
                          onChange={event => updateField(fieldId, { defaultValue: event.target.value })}
                          className={editorInputClassName}
                        />
                      </label>
                      <label className={`${editorLabelClassName} md:col-span-2`}>
                        Help text
                        <textarea
                          value={field.helpText || ''}
                          onChange={event => updateField(fieldId, { helpText: event.target.value })}
                          rows={2}
                          className={editorInputClassName}
                        />
                      </label>
                      {field.type === 'textarea' && (
                        <label className={editorLabelClassName}>
                          Filas textarea
                          <input
                            type="number"
                            value={field.settings?.rows || 4}
                            onChange={event => updateField(fieldId, { settings: { ...field.settings, rows: Number(event.target.value) || 4 } })}
                            className={editorInputClassName}
                          />
                        </label>
                      )}
                      {['select', 'radio'].includes(field.type) && (
                        <label className={`${editorLabelClassName} md:col-span-2`}>
                          Opciones
                          <textarea
                            value={optionsToTextarea(field.options)}
                            onChange={event => updateField(fieldId, { options: textareaToOptions(event.target.value) })}
                            rows={4}
                            placeholder={'Etiqueta|valor\nMayoreo|mayoreo'}
                            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />
                        </label>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-[15px] font-medium leading-6 text-slate-800">
                        <input
                          type="checkbox"
                          checked={Boolean(field.enabled)}
                          onChange={event => updateField(fieldId, { enabled: event.target.checked })}
                        />
                        Campo habilitado
                      </label>
                      <label className="flex items-center gap-2 text-[15px] font-medium leading-6 text-slate-800">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          onChange={event => updateField(fieldId, { required: event.target.checked })}
                        />
                        Requerido
                      </label>
                      <label className="flex items-center gap-2 text-[15px] font-medium leading-6 text-slate-800">
                        <input
                          type="checkbox"
                          checked={Boolean(field.locked)}
                          onChange={event => updateField(fieldId, { locked: event.target.checked })}
                        />
                        Bloqueado
                      </label>
                    </div>
                      </>
                    )}
                  </article>
                    );
                  })()
                ))}
                </div>
              </div>
            </>
          )}
        </article>

        <aside className="space-y-6">
          <DynamicFormRenderer
            form={selectedForm || { fields: [] }}
            readOnly
            title={selectedForm?.title || 'Preview'}
            description={selectedForm?.description || 'Vista previa del formulario reutilizable.'}
            submitLabel={selectedForm?.submitLabel || 'Enviar'}
          />
          <div className="theme-panel-subtle rounded-[28px] p-6 text-sm" style={{ color: 'var(--muted-color)' }}>
            La vista previa sigue el orden actual del builder. Si quitas un campo o un formulario, no se pierde
            hasta que guardes.
          </div>
        </aside>
      </div>
    </section>
  );
};

export default FormBuilderPage;
