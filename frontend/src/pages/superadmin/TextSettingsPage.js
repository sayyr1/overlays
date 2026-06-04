import React, { useEffect, useState } from 'react';
import { getSuperAdminTextSettings, updateSuperAdminTextSetting } from '../../api/superAdmin';
import { usePublicConfig } from '../../context/PublicConfigContext';

const TextSettingsPage = () => {
  const [textSettings, setTextSettings] = useState([]);
  const [savingKey, setSavingKey] = useState('');
  const { upsertPublicTextSetting } = usePublicConfig();

  const loadTextSettings = async () => {
    const { data } = await getSuperAdminTextSettings();
    setTextSettings(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadTextSettings();
  }, []);

  const updateField = (key, value) => {
    setTextSettings(prev =>
      prev.map(item => (item.key === key ? { ...item, value } : item))
    );
  };

  const handleSave = async item => {
    setSavingKey(item.key);
    try {
      const { data } = await updateSuperAdminTextSetting(item.key, { value: item.value });
      setTextSettings(prev =>
        prev.map(current => (current.key === item.key ? data : current))
      );
      upsertPublicTextSetting(data);
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No se pudo guardar el texto.');
    } finally {
      setSavingKey('');
    }
  };

  return (
    <section className="rounded-3xl bg-white p-8 shadow-brand-sm">
      <h2 className="text-2xl font-semibold text-slate-900">Textos basicos</h2>
      <p className="mt-2 text-sm text-slate-500">Edicion rapida de copys visibles en la tienda.</p>

      <div className="mt-6 space-y-4">
        {textSettings.map(item => (
          <article key={item.key} className="rounded-2xl border border-slate-200 p-5">
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{item.label}</h3>
                <p className="text-xs uppercase tracking-wide text-slate-400">{item.key}</p>
                <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              </div>
              <textarea
                value={item.value || ''}
                onChange={event => updateField(item.key, event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
              <div>
                <button
                  type="button"
                  onClick={() => handleSave(item)}
                  disabled={savingKey === item.key}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingKey === item.key ? 'Guardando...' : 'Guardar texto'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default TextSettingsPage;
