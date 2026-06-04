import React, { useCallback, useEffect, useState } from 'react';
import { getSuperAdminModules, updateSuperAdminModule } from '../../api/superAdmin';
import { usePublicConfig } from '../../context/PublicConfigContext';

const ModuleConfigPage = () => {
  const [modules, setModules] = useState([]);
  const [savingKey, setSavingKey] = useState('');
  const { setPublicModules, upsertPublicModule } = usePublicConfig();

  const loadModules = useCallback(async () => {
    const { data } = await getSuperAdminModules();
    const nextModules = Array.isArray(data) ? data : [];
    setModules(nextModules);
    setPublicModules(nextModules);
  }, [setPublicModules]);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  const updateField = (key, field, value) => {
    setModules(prev =>
      prev.map(item => (item.key === key ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = async moduleItem => {
    setSavingKey(moduleItem.key);
    try {
      const { data } = await updateSuperAdminModule(moduleItem.key, {
        enabled: moduleItem.enabled,
        status: moduleItem.status,
        order: moduleItem.order
      });

      setModules(prev =>
        prev.map(item => (item.key === data.key ? data : item))
      );
      upsertPublicModule(data);
      window.alert(`Modulo ${moduleItem.label} actualizado.`);
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No se pudo actualizar el modulo.');
    } finally {
      setSavingKey('');
    }
  };

  return (
    <section className="rounded-3xl bg-white p-8 shadow-brand-sm">
      <h2 className="text-2xl font-semibold text-slate-900">Modulos activos</h2>
      <p className="mt-2 text-sm text-slate-500">Activa, desactiva o marca modulos como proximos.</p>

      <div className="mt-6 space-y-4">
        {modules.map(moduleItem => (
          <article key={moduleItem.key} className="rounded-2xl border border-slate-200 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{moduleItem.label}</h3>
                <p className="text-sm text-slate-500">{moduleItem.description}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{moduleItem.key}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm text-slate-700">
                  Estado
                  <select
                    value={moduleItem.status}
                    onChange={event => updateField(moduleItem.key, 'status', event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="coming_soon">coming_soon</option>
                  </select>
                </label>
                <label className="text-sm text-slate-700">
                  Orden
                  <input
                    type="number"
                    value={moduleItem.order}
                    onChange={event => updateField(moduleItem.key, 'order', Number(event.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={moduleItem.enabled}
                    onChange={event => updateField(moduleItem.key, 'enabled', event.target.checked)}
                  />
                  Habilitado
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSave(moduleItem)}
              disabled={savingKey === moduleItem.key}
              className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingKey === moduleItem.key ? 'Guardando...' : 'Guardar modulo'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ModuleConfigPage;
