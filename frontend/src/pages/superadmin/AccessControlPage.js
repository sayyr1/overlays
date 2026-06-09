import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createSuperAdminAccessControlUser,
  getSuperAdminAccessControl,
  updateSuperAdminAccessControlUser,
  updateSuperAdminUserRole
} from '../../api/superAdmin';

const clonePermissions = permissions => JSON.parse(JSON.stringify(permissions || {}));
const PRIMARY_ROLE_ORDER = ['superadmin', 'owner', 'sales'];
const LEGACY_ROLE_ORDER = ['admin'];
const INTERNAL_ROLE_ORDER = [...PRIMARY_ROLE_ORDER, ...LEGACY_ROLE_ORDER];

const ROLE_TONE = {
  superadmin: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  owner: 'border border-sky-200 bg-sky-50 text-sky-700',
  sales: 'border border-amber-200 bg-amber-50 text-amber-700',
  admin: 'border border-slate-200 bg-slate-100 text-slate-700'
};

const ROLE_SCOPE = {
  superadmin: ['Configuracion global', 'Modulos', 'Auditoria', 'Permisos'],
  owner: ['Catalogo', 'Inventario', 'Pedidos', 'CRM', 'Reportes'],
  sales: ['CRM', 'Clientes', 'Pedidos', 'Seguimiento', 'Membresias'],
  admin: ['Compatibilidad', 'Migracion pendiente']
};

const STATUS_TONE = {
  success: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border border-red-200 bg-red-50 text-red-700',
  info: 'border border-slate-200 bg-slate-50 text-slate-600'
};

const getUserDisplayName = user => user?.name || 'Sin nombre';
const getUserDisplayUsername = user => user?.username || 'sin-usuario';
const getUserDisplayEmail = user => user?.email || '';

const AccessControlPage = () => {
  const [catalog, setCatalog] = useState([]);
  const [presets, setPresets] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [draftRoles, setDraftRoles] = useState({});
  const [selectedPresets, setSelectedPresets] = useState({});
  const [statusByUser, setStatusByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [createForm, setCreateForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'sales'
  });
  const [createStatus, setCreateStatus] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);

  const setUserStatus = useCallback((userId, tone, message) => {
    setStatusByUser(prev => ({
      ...prev,
      [userId]: { tone, message }
    }));
  }, []);

  const syncUserState = useCallback(userList => {
    setDrafts(
      userList.reduce((acc, user) => {
        acc[user._id] = clonePermissions(user.effectivePermissions);
        return acc;
      }, {})
    );
    setDraftRoles(
      userList.reduce((acc, user) => {
        acc[user._id] = user.role;
        return acc;
      }, {})
    );
    setSelectedPresets(
      userList.reduce((acc, user) => {
        acc[user._id] = '';
        return acc;
      }, {})
    );
  }, []);

  const loadAccessControl = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getSuperAdminAccessControl();
      const nextCatalog = Array.isArray(data?.catalog) ? data.catalog : [];
      const nextPresets = Array.isArray(data?.presets) ? data.presets : [];
      const nextRoles = Array.isArray(data?.roles) ? data.roles : [];
      const nextUsers = Array.isArray(data?.users) ? data.users : [];

      setCatalog(nextCatalog);
      setPresets(nextPresets);
      setRoles(nextRoles);
      setUsers(nextUsers);
      syncUserState(nextUsers);
      setStatusByUser({});
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo cargar el control de acceso.');
    } finally {
      setLoading(false);
    }
  }, [syncUserState]);

  useEffect(() => {
    loadAccessControl();
  }, [loadAccessControl]);

  const groupedUsers = useMemo(() => {
    const groups = users.reduce((acc, user) => {
      const key = user.role || 'admin';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(user);
      return acc;
    }, {});

    return INTERNAL_ROLE_ORDER
      .filter(roleKey => Array.isArray(groups[roleKey]) && groups[roleKey].length > 0)
      .map(roleKey => ({
        roleKey,
        roleMeta: roles.find(role => role.key === roleKey),
        users: [...groups[roleKey]].sort((a, b) =>
          getUserDisplayName(a).localeCompare(getUserDisplayName(b))
        )
      }));
  }, [roles, users]);

  const primaryGroups = useMemo(
    () => groupedUsers.filter(group => PRIMARY_ROLE_ORDER.includes(group.roleKey)),
    [groupedUsers]
  );

  const legacyGroup = useMemo(
    () => groupedUsers.find(group => group.roleKey === 'admin') || null,
    [groupedUsers]
  );

  const visiblePresets = useMemo(
    () => presets.filter(preset => preset.key !== 'full_admin'),
    [presets]
  );

  const roleOptions = useMemo(
    () => roles.filter(role => ['owner', 'sales'].includes(role.key)),
    [roles]
  );

  const createRoleOptions = useMemo(
    () => roles.filter(role => ['superadmin', 'owner', 'sales'].includes(role.key)),
    [roles]
  );

  const roleCards = useMemo(
    () =>
      PRIMARY_ROLE_ORDER.map(roleKey => {
        const roleMeta = roles.find(role => role.key === roleKey);
        const count = users.filter(user => user.role === roleKey).length;
        return {
          key: roleKey,
          label: roleMeta?.label || roleKey,
          description: roleMeta?.description || 'Perfil interno del sistema.',
          count
        };
      }),
    [roles, users]
  );

  const catalogStats = useMemo(() => {
    const totalModules = catalog.length;
    const totalActions = catalog.reduce((acc, item) => acc + (item.actions?.length || 0), 0);
    const totalUsers = users.length;
    return { totalModules, totalActions, totalUsers };
  }, [catalog, users]);

  const handleCreateInputChange = event => {
    const { name, value } = event.target;
    setCreateForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateUser = async event => {
    event.preventDefault();
    setCreatingUser(true);
    setCreateStatus(null);

    try {
      await createSuperAdminAccessControlUser({
        name: createForm.name.trim(),
        username: createForm.username.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role
      });
      setCreateForm({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'sales'
      });
      await loadAccessControl();
      setCreateStatus({
        tone: 'success',
        message: 'Usuario interno creado correctamente.'
      });
    } catch (requestError) {
      setCreateStatus({
        tone: 'error',
        message: requestError?.response?.data?.message || 'No se pudo crear el usuario.'
      });
    } finally {
      setCreatingUser(false);
    }
  };

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
    setUserStatus(userId, 'info', 'Tienes cambios pendientes de guardar.');
  };

  const syncUpdatedUser = useCallback(
    data => {
      setUsers(prev => prev.map(user => (user._id === data._id ? data : user)));
      setDrafts(prev => ({
        ...prev,
        [data._id]: clonePermissions(data.effectivePermissions)
      }));
      setDraftRoles(prev => ({
        ...prev,
        [data._id]: data.role
      }));
      setSelectedPresets(prev => ({
        ...prev,
        [data._id]: ''
      }));
    },
    []
  );

  const handleRoleSave = async userId => {
    const nextRole = draftRoles[userId];
    if (!nextRole) return;

    setSavingId(userId);
    try {
      const { data } = await updateSuperAdminUserRole(userId, { role: nextRole });
      syncUpdatedUser(data);
      setUserStatus(
        userId,
        'success',
        nextRole === 'owner'
          ? 'Usuario migrado a Dueno.'
          : 'Usuario migrado a Equipo de ventas.'
      );
    } catch (requestError) {
      setUserStatus(
        userId,
        'error',
        requestError?.response?.data?.message || 'No se pudo actualizar el rol.'
      );
    } finally {
      setSavingId('');
    }
  };

  const handleSave = async userId => {
    setSavingId(userId);
    try {
      const { data } = await updateSuperAdminAccessControlUser(userId, {
        permissions: drafts[userId] || {}
      });
      syncUpdatedUser(data);
      setUserStatus(userId, 'success', 'Permisos actualizados correctamente.');
    } catch (requestError) {
      setUserStatus(
        userId,
        'error',
        requestError?.response?.data?.message || 'No se pudieron guardar los permisos.'
      );
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
      syncUpdatedUser(data);
      setUserStatus(userId, 'success', 'Permisos restaurados al perfil por defecto.');
    } catch (requestError) {
      setUserStatus(
        userId,
        'error',
        requestError?.response?.data?.message || 'No se pudieron restaurar los permisos.'
      );
    } finally {
      setSavingId('');
    }
  };

  const handleApplyPreset = async userId => {
    const presetKey = selectedPresets[userId];
    if (!presetKey) {
      setUserStatus(userId, 'error', 'Selecciona un preset antes de aplicarlo.');
      return;
    }

    setSavingId(userId);
    try {
      const { data } = await updateSuperAdminAccessControlUser(userId, { presetKey });
      syncUpdatedUser(data);
      const appliedPreset = visiblePresets.find(preset => preset.key === presetKey);
      setUserStatus(
        userId,
        'success',
        `Preset aplicado: ${appliedPreset?.label || presetKey}.`
      );
    } catch (requestError) {
      setUserStatus(
        userId,
        'error',
        requestError?.response?.data?.message || 'No se pudo aplicar el preset.'
      );
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
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className="rounded-[28px] bg-white p-8 shadow-brand-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Gobierno interno
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">
            Roles y permisos del backoffice
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            La operacion visible queda reducida a tres perfiles: Super Admin, Dueno y
            Equipo de ventas. El rol <strong>admin</strong> ya no se usa como perfil
            operativo nuevo y solo aparece aqui si existen usuarios heredados pendientes
            de migracion.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-brand-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Usuarios</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{catalogStats.totalUsers}</p>
            <p className="mt-1 text-sm text-slate-500">Internos configurables</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-brand-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Modulos</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{catalogStats.totalModules}</p>
            <p className="mt-1 text-sm text-slate-500">Bloques de permisos</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-brand-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Acciones</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{catalogStats.totalActions}</p>
            <p className="mt-1 text-sm text-slate-500">Permisos configurables</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {roleCards.map(role => (
          <article key={role.key} className="rounded-[28px] bg-white p-6 shadow-brand-sm">
            <div className="flex items-center justify-between gap-3">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  ROLE_TONE[role.key] || ROLE_TONE.admin
                }`}
              >
                {role.label}
              </span>
              <span className="text-2xl font-semibold text-slate-950">{role.count}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">{role.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(ROLE_SCOPE[role.key] || []).map(item => (
                <span
                  key={`${role.key}-${item}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {item}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-[28px] bg-white p-6 shadow-brand-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Alta interna
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">
            Crear usuarios para operacion y administracion
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Genera accesos para equipo de ventas, dueno de tienda o nuevos super admin
            usando nombre de usuario y contrasena. El correo queda opcional.
          </p>

          {createStatus?.message && (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                STATUS_TONE[createStatus.tone] || STATUS_TONE.info
              }`}
            >
              {createStatus.message}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600">
              Nombre
              <input
                type="text"
                name="name"
                value={createForm.name}
                onChange={handleCreateInputChange}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800"
                placeholder="Nombre completo"
                required
              />
            </label>

            <label className="text-sm text-slate-600">
              Nombre de usuario
              <input
                type="text"
                name="username"
                value={createForm.username}
                onChange={handleCreateInputChange}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800"
                placeholder="usuario.equipo"
                required
              />
            </label>

            <label className="text-sm text-slate-600">
              Correo opcional
              <input
                type="email"
                name="email"
                value={createForm.email}
                onChange={handleCreateInputChange}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800"
                placeholder="correo@empresa.com"
              />
            </label>

            <label className="text-sm text-slate-600">
              Rol
              <select
                name="role"
                value={createForm.role}
                onChange={handleCreateInputChange}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800"
              >
                {createRoleOptions.map(role => (
                  <option key={role.key} value={role.key}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-600 md:col-span-2">
              Contrasena inicial
              <input
                type="password"
                name="password"
                value={createForm.password}
                onChange={handleCreateInputChange}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800"
                placeholder="Minimo 6 caracteres"
                minLength={6}
                required
              />
            </label>

            <div className="md:col-span-2 flex flex-wrap justify-end gap-3">
              <button
                type="submit"
                disabled={creatingUser}
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {creatingUser ? 'Creando...' : 'Crear usuario interno'}
              </button>
            </div>
          </form>
        </div>

        <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-brand-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Identidad
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">
            Nuevo acceso basado en username
          </h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-500">
            <p>El login principal ahora usa nombre de usuario en lugar de correo.</p>
            <p>Las cuentas anteriores pueden seguir entrando con correo mientras migran.</p>
            <p>Los nuevos usuarios internos se crean desde esta vista, no desde el registro publico.</p>
          </div>
        </aside>
      </div>

      {visiblePresets.length > 0 && (
        <div className="rounded-[28px] bg-white p-6 shadow-brand-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Presets visibles
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">
                Perfiles reutilizables para asignacion rapida
              </h3>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {visiblePresets.length} presets disponibles
            </span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {visiblePresets.map(preset => (
              <div
                key={preset.key}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <p className="text-sm font-semibold text-slate-900">{preset.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{preset.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {primaryGroups.map(group => (
          <div key={group.roleKey} className="space-y-4">
            <div className="rounded-[28px] bg-white p-6 shadow-brand-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    ROLE_TONE[group.roleKey] || ROLE_TONE.admin
                  }`}
                >
                  {group.roleMeta?.label || group.roleKey}
                </span>
                <span className="text-sm text-slate-500">
                  {group.users.length} usuario{group.users.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {group.roleMeta?.description || 'Perfil interno del sistema.'}
              </p>
            </div>

            {group.users.map(user => {
              const isSuperAdmin = user.role === 'superadmin';
              const userStatus = statusByUser[user._id];
              const activeRole = roles.find(role => role.key === user.role);

              return (
                <article key={user._id} className="rounded-[28px] bg-white p-6 shadow-brand-sm">
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-semibold text-slate-950">
                            {getUserDisplayName(user)}
                          </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            ROLE_TONE[user.role] || ROLE_TONE.admin
                          }`}
                        >
                            {activeRole?.label || user.role}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700">
                        @{getUserDisplayUsername(user)}
                      </p>
                      {getUserDisplayEmail(user) && (
                        <p className="text-sm text-slate-500">{getUserDisplayEmail(user)}</p>
                      )}
                    </div>

                    {!isSuperAdmin ? (
                      <div className="flex flex-wrap gap-3">
                        <select
                          value={draftRoles[user._id] || user.role}
                          onChange={event =>
                            setDraftRoles(prev => ({ ...prev, [user._id]: event.target.value }))
                          }
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                        >
                          {roleOptions.map(role => (
                            <option key={role.key} value={role.key}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRoleSave(user._id)}
                          disabled={savingId === user._id || draftRoles[user._id] === user.role}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                        >
                          Guardar rol
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                        Acceso total por rol
                      </div>
                    )}
                  </div>

                  {userStatus?.message && (
                    <div
                      className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                        STATUS_TONE[userStatus.tone] || STATUS_TONE.info
                      }`}
                    >
                      {userStatus.message}
                    </div>
                  )}

                  {!isSuperAdmin && (
                    <>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <select
                          value={selectedPresets[user._id] || ''}
                          onChange={event =>
                            setSelectedPresets(prev => ({
                              ...prev,
                              [user._id]: event.target.value
                            }))
                          }
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                        >
                          <option value="">Aplicar preset...</option>
                          {visiblePresets.map(preset => (
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
                          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {savingId === user._id ? 'Guardando...' : 'Guardar permisos'}
                        </button>
                      </div>

                      <div className="mt-6 grid gap-4 xl:grid-cols-2">
                        {catalog.map(groupItem => (
                          <div
                            key={`${user._id}-${groupItem.module}`}
                            className="rounded-2xl border border-slate-200 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h4 className="text-base font-semibold text-slate-950">
                                  {groupItem.label}
                                </h4>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                  {groupItem.description}
                                </p>
                              </div>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                                {(groupItem.actions || []).length} permisos
                              </span>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              {(groupItem.actions || []).map(action => {
                                const checked = Boolean(
                                  drafts[user._id]?.[groupItem.module]?.[action.key]
                                );
                                return (
                                  <label
                                    key={`${groupItem.module}-${action.key}`}
                                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                                      checked
                                        ? 'border-slate-900 bg-slate-950 text-white'
                                        : 'border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={event =>
                                        updatePermission(
                                          user._id,
                                          groupItem.module,
                                          action.key,
                                          event.target.checked
                                        )
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
                    </>
                  )}
                </article>
              );
            })}
          </div>
        ))}

        {legacyGroup && (
          <div className="space-y-4">
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-brand-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ROLE_TONE.admin}`}>
                  Admin legado
                </span>
                <span className="text-sm font-medium text-amber-800">
                  {legacyGroup.users.length} usuario{legacyGroup.users.length === 1 ? '' : 's'} por migrar
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                Estos usuarios siguen funcionando por compatibilidad, pero ya no
                pertenecen al esquema recomendado. Migralos a Dueno o Equipo de ventas
                para un modelo mas claro y sostenible.
              </p>
            </div>

            {legacyGroup.users.map(user => {
              const userStatus = statusByUser[user._id];

              return (
                <article key={user._id} className="rounded-[28px] bg-white p-6 shadow-brand-sm">
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-semibold text-slate-950">
                          {getUserDisplayName(user)}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${ROLE_TONE.admin}`}
                        >
                          Admin legado
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700">
                        @{getUserDisplayUsername(user)}
                      </p>
                      {getUserDisplayEmail(user) && (
                        <p className="text-sm text-slate-500">{getUserDisplayEmail(user)}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <select
                        value={draftRoles[user._id] || user.role}
                        onChange={event =>
                          setDraftRoles(prev => ({ ...prev, [user._id]: event.target.value }))
                        }
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                      >
                        {roleOptions.map(role => (
                          <option key={role.key} value={role.key}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRoleSave(user._id)}
                        disabled={savingId === user._id || draftRoles[user._id] === user.role}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                      >
                        Migrar rol
                      </button>
                    </div>
                  </div>

                  {userStatus?.message && (
                    <div
                      className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                        STATUS_TONE[userStatus.tone] || STATUS_TONE.info
                      }`}
                    >
                      {userStatus.message}
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {visiblePresets.map(preset => (
                      <div
                        key={`${user._id}-legacy-${preset.key}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <p className="text-sm font-semibold text-slate-900">{preset.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {preset.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!primaryGroups.length && !legacyGroup && !loading && (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-brand-sm">
            No hay usuarios internos para configurar.
          </div>
        )}
      </div>
    </section>
  );
};

export default AccessControlPage;
