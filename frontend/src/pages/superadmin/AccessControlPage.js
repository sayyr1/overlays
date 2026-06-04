import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getSuperAdminAccessControl,
  updateSuperAdminAccessControlUser
} from '../../api/superAdmin';

const clonePermissions = permissions => JSON.parse(JSON.stringify(permissions || {}));

const AccessControlPage = () => {
  const [catalog, setCatalog] = useState([]);
  const [presets, setPresets] = useState([]);
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [selectedPresets, setSelectedPresets] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const loadAccessControl = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getSuperAdminAccessControl();
      const nextCatalog = Array.isArray(data?.catalog) ? data.catalog : [];
      const nextPresets = Array.isArray(data?.presets) ? data.presets : [];
      const nextUsers = Array.isArray(data?.users) ? data.users : [];
      setCatalog(nextCatalog);
      setPresets(nextPresets);
      setUsers(nextUsers);
      setDrafts(
        nextUsers.reduce((acc, user) => {
          acc[user._id] = clonePermissions(user.effectivePermissions);
          return acc;
        }, {})
      );
      setSelectedPresets(
        nextUsers.reduce((acc, user) => {
          acc[user._id] = '';
          return acc;
        }, {})
      );
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo cargar el control de acceso.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccessControl();
  }, [loadAccessControl]);

  const editableAdmins = useMemo(
    () => users.filter(user => user.role === 'admin'),
    [users]
  );

  const superAdmins = useMemo(
    () => users.filter(user => user.role === 'superadmin'),
    [users]
  );

  const updatePermission = (userId, moduleKey, actionKey, value) => {
    setDrafts(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [moduleKey]: {
          ...((prev[userId] || {})[moduleKey] || {}),
          [actionKey]: value
        }
      }
    }));
  };

  const handleSave = async userId => {
    setSavingId(userId);
    try {
      const { data } = await updateSuperAdminAccessControlUser(userId, {
        permissions: drafts[userId] || {}
      });
      setUsers(prev => prev.map(user => (user._id === data._id ? data : user)));
      setDrafts(prev => ({
        ...prev,
        [userId]: clonePermissions(data.effectivePermissions)
      }));
      window.alert('Permisos actualizados.');
    } catch (requestError) {
      window.alert(requestError?.response?.data?.message || 'No se pudieron guardar los permisos.');
    } finally {
      setSavingId('');
    }
  };

  const handleReset = async userId => {
    setSavingId(userId);
    try {
      const { data } = await updateSuperAdminAccessControlUser(userId, {
        useDefaultPermissions: true
      });
      setUsers(prev => prev.map(user => (user._id === data._id ? data : user)));
      setDrafts(prev => ({
        ...prev,
        [userId]: clonePermissions(data.effectivePermissions)
      }));
      window.alert('Permisos restaurados al perfil admin por defecto.');
    } catch (requestError) {
      window.alert(requestError?.response?.data?.message || 'No se pudieron restaurar los permisos.');
    } finally {
      setSavingId('');
    }
  };

  const handleApplyPreset = async userId => {
    const presetKey = selectedPresets[userId];
    if (!presetKey) {
      window.alert('Selecciona un preset antes de aplicarlo.');
      return;
    }

    setSavingId(userId);
    try {
      const { data } = await updateSuperAdminAccessControlUser(userId, {
        presetKey
      });
      setUsers(prev => prev.map(user => (user._id === data._id ? data : user)));
      setDrafts(prev => ({
        ...prev,
        [userId]: clonePermissions(data.effectivePermissions)
      }));
      window.alert('Preset aplicado.');
    } catch (requestError) {
      window.alert(requestError?.response?.data?.message || 'No se pudo aplicar el preset.');
    } finally {
      setSavingId('');
    }
  };

  if (loading) {
    return (
      <section className="rounded-3xl bg-white p-8 shadow-brand-sm">
        <p className="text-sm text-slate-500">Cargando control de acceso...</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-brand-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Control de acceso</h2>
        <p className="mt-2 text-sm text-slate-500">
          Ajusta permisos operativos por accion para usuarios admin. Los superadmin mantienen acceso total.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {superAdmins.length > 0 && (
        <div className="rounded-3xl bg-white p-6 shadow-brand-sm">
          <h3 className="text-lg font-semibold text-slate-900">Super Admin</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {superAdmins.map(user => (
              <article key={user._id} className="rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-emerald-600">
                  Acceso total por rol
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {editableAdmins.map(user => (
          <article key={user._id} className="rounded-3xl bg-white p-6 shadow-brand-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{user.name}</h3>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <select
                  value={selectedPresets[user._id] || ''}
                  onChange={event =>
                    setSelectedPresets(prev => ({ ...prev, [user._id]: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                >
                  <option value="">Aplicar preset...</option>
                  {presets.map(preset => (
                    <option key={preset.key} value={preset.key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(user._id)}
                  disabled={savingId === user._id || !selectedPresets[user._id]}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                  Aplicar preset
                </button>
                <button
                  type="button"
                  onClick={() => handleReset(user._id)}
                  disabled={savingId === user._id}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                  Restaurar default
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(user._id)}
                  disabled={savingId === user._id}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingId === user._id ? 'Guardando...' : 'Guardar permisos'}
                </button>
              </div>
            </div>

            {presets.length > 0 && (
              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {presets.map(preset => (
                  <div key={`${user._id}-${preset.key}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">{preset.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{preset.description}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {catalog.map(group => (
                <div key={`${user._id}-${group.module}`} className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="text-base font-semibold text-slate-900">{group.label}</h4>
                  <p className="mt-1 text-sm text-slate-500">{group.description}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(group.actions || []).map(action => {
                      const checked = Boolean(drafts[user._id]?.[group.module]?.[action.key]);
                      return (
                        <label
                          key={`${group.module}-${action.key}`}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={event =>
                              updatePermission(user._id, group.module, action.key, event.target.checked)
                            }
                          />
                          <span>{action.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}

        {!editableAdmins.length && !loading && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-brand-sm">
            No hay usuarios admin para configurar.
          </div>
        )}
      </div>
    </section>
  );
};

export default AccessControlPage;
