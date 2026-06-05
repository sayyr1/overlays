import { USER_ROLES } from '../models/User.js';

export const PERMISSION_CATALOG = [
  {
    module: 'products',
    label: 'Catalogo',
    description: 'Consulta y administra fichas de producto.',
    actions: [
      { key: 'view', label: 'Ver catalogo' },
      { key: 'create', label: 'Crear productos' },
      { key: 'edit', label: 'Editar productos' },
      { key: 'delete', label: 'Eliminar productos' },
      { key: 'upload', label: 'Subir imagenes' }
    ]
  },
  {
    module: 'inventory',
    label: 'Inventario',
    description: 'Opera stock, pedidos internos y ventas manuales.',
    actions: [
      { key: 'view', label: 'Ver inventario' },
      { key: 'adjust', label: 'Registrar pedidos y ventas' },
      { key: 'confirm', label: 'Confirmar reservas como ventas' }
    ]
  },
  {
    module: 'orders',
    label: 'Pedidos',
    description: 'Gestiona pedidos de clientes y su ciclo operativo.',
    actions: [
      { key: 'view', label: 'Ver pedidos' },
      { key: 'confirm', label: 'Confirmar pagos' },
      { key: 'cancel', label: 'Cancelar pedidos' },
      { key: 'update', label: 'Actualizar estados' },
      { key: 'deleteHistory', label: 'Borrar historial' }
    ]
  },
  {
    module: 'reports',
    label: 'Reportes',
    description: 'Consulta KPIs y resetea historicos operativos.',
    actions: [
      { key: 'view', label: 'Ver reportes' },
      { key: 'reset', label: 'Reiniciar historicos' }
    ]
  },
  {
    module: 'categories',
    label: 'Categorias',
    description: 'Mantiene taxonomias, filtros y atributos base.',
    actions: [
      { key: 'manage', label: 'Gestionar categorias' }
    ]
  },
  {
    module: 'brands',
    label: 'Marcas',
    description: 'Administra el catalogo de marcas.',
    actions: [
      { key: 'manage', label: 'Gestionar marcas' }
    ]
  },
  {
    module: 'menu',
    label: 'Menu',
    description: 'Administra la navegacion principal del storefront.',
    actions: [
      { key: 'manage', label: 'Gestionar menu' }
    ]
  },
  {
    module: 'customers',
    label: 'Clientes',
    description: 'Consulta cartera de clientes y sus datos base.',
    actions: [
      { key: 'view', label: 'Ver clientes' }
    ]
  },
  {
    module: 'memberships',
    label: 'Membresias',
    description: 'Ajusta niveles comerciales de clientes.',
    actions: [
      { key: 'manage', label: 'Gestionar membresias' }
    ]
  },
  {
    module: 'crm',
    label: 'CRM',
    description: 'Gestiona contactos, pipeline, tareas, abandonos y configuracion comercial.',
    actions: [
      { key: 'dashboard', label: 'Ver dashboard CRM' },
      { key: 'pipelineView', label: 'Ver pipeline' },
      { key: 'pipelineManage', label: 'Gestionar pipeline' },
      { key: 'contactsView', label: 'Ver contactos' },
      { key: 'contactsEdit', label: 'Editar contactos' },
      { key: 'eventsView', label: 'Ver historial de eventos' },
      { key: 'tasksView', label: 'Ver tareas CRM' },
      { key: 'tasksManage', label: 'Gestionar tareas CRM' },
      { key: 'abandonedView', label: 'Ver carritos abandonados' },
      { key: 'abandonedManage', label: 'Gestionar carritos abandonados' },
      { key: 'productInterestView', label: 'Ver interes por producto' },
      { key: 'configManage', label: 'Configurar CRM' }
    ]
  }
];

export const createEmptyPermissionMatrix = () =>
  PERMISSION_CATALOG.reduce((acc, group) => {
    acc[group.module] = group.actions.reduce((actionAcc, action) => {
      actionAcc[action.key] = false;
      return actionAcc;
    }, {});
    return acc;
  }, {});

const buildPresetPermissions = entries => {
  const matrix = createEmptyPermissionMatrix();
  entries.forEach(([moduleKey, actions]) => {
    (actions || []).forEach(actionKey => {
      if (matrix[moduleKey] && Object.prototype.hasOwnProperty.call(matrix[moduleKey], actionKey)) {
        matrix[moduleKey][actionKey] = true;
      }
    });
  });
  return matrix;
};

const buildFullAccessPermissions = () =>
  PERMISSION_CATALOG.reduce((acc, group) => {
    acc[group.module] = group.actions.reduce((actionAcc, action) => {
      actionAcc[action.key] = true;
      return actionAcc;
    }, {});
    return acc;
  }, {});

export const ROLE_DEFINITIONS = [
  {
    key: USER_ROLES.SUPERADMIN,
    label: 'Super Admin',
    description: 'Control total del sistema, configuracion global, auditoria y acceso completo.'
  },
  {
    key: USER_ROLES.OWNER,
    label: 'Dueno',
    description: 'Responsable del negocio con acceso completo al backoffice operativo.'
  },
  {
    key: USER_ROLES.SALES,
    label: 'Equipo de ventas',
    description: 'Perfil comercial enfocado en CRM, clientes, pedidos y seguimiento.'
  },
  {
    key: USER_ROLES.ADMIN,
    label: 'Admin legado',
    description: 'Perfil historico equivalente a acceso interno completo. Mantener solo por compatibilidad.'
  },
  {
    key: USER_ROLES.CUSTOMER,
    label: 'Cliente',
    description: 'Usuario final de tienda sin acceso administrativo.'
  }
];

const ROLE_DEFAULTS = {
  [USER_ROLES.CUSTOMER]: {},
  [USER_ROLES.SALES]: buildPresetPermissions([
    ['products', ['view']],
    ['inventory', ['view']],
    ['orders', ['view', 'confirm', 'cancel', 'update']],
    ['customers', ['view']],
    ['memberships', ['manage']],
    ['crm', ['dashboard', 'pipelineView', 'pipelineManage', 'contactsView', 'contactsEdit', 'eventsView', 'tasksView', 'tasksManage', 'abandonedView', 'abandonedManage', 'productInterestView']]
  ]),
  [USER_ROLES.OWNER]: buildFullAccessPermissions(),
  [USER_ROLES.ADMIN]: buildFullAccessPermissions(),
  [USER_ROLES.SUPERADMIN]: buildFullAccessPermissions()
};

export const PERMISSION_PRESETS = [
  {
    key: 'owner_default',
    label: 'Dueno',
    description: 'Acceso completo del backoffice sin privilegios de Super Admin.',
    permissions: buildFullAccessPermissions()
  },
  {
    key: 'sales_team',
    label: 'Equipo de ventas',
    description: 'CRM, clientes, pedidos y seguimiento comercial con enfoque operativo.',
    permissions: ROLE_DEFAULTS[USER_ROLES.SALES]
  },
  {
    key: 'full_admin',
    label: 'Admin total',
    description: 'Operacion completa del backoffice sin acceso Super Admin.',
    permissions: buildFullAccessPermissions()
  },
  {
    key: 'catalog_manager',
    label: 'Gestor de catalogo',
    description: 'Administra fichas, imagenes, marcas y categorias sin operar pedidos.',
    permissions: buildPresetPermissions([
      ['products', ['view', 'create', 'edit', 'delete', 'upload']],
      ['categories', ['manage']],
      ['brands', ['manage']]
    ])
  },
  {
    key: 'operations_manager',
    label: 'Operaciones',
    description: 'Gestiona inventario, pedidos y consulta reportes operativos.',
    permissions: buildPresetPermissions([
      ['products', ['view']],
      ['inventory', ['view', 'adjust', 'confirm']],
      ['orders', ['view', 'confirm', 'cancel', 'update', 'deleteHistory']],
      ['reports', ['view']]
    ])
  },
  {
    key: 'analyst',
    label: 'Analista',
    description: 'Consulta catalogo, reportes y clientes en modo lectura.',
    permissions: buildPresetPermissions([
      ['products', ['view']],
      ['inventory', ['view']],
      ['reports', ['view']],
      ['customers', ['view']]
    ])
  },
  {
    key: 'customer_success',
    label: 'Atencion comercial',
    description: 'Da seguimiento a clientes, pedidos y membresias.',
    permissions: buildPresetPermissions([
      ['orders', ['view', 'update', 'cancel']],
      ['customers', ['view']],
      ['memberships', ['manage']],
      ['crm', ['dashboard', 'pipelineView', 'pipelineManage', 'contactsView', 'contactsEdit', 'eventsView', 'tasksView', 'tasksManage', 'abandonedView', 'abandonedManage']]
    ])
  },
  {
    key: 'crm_manager',
    label: 'Gestor CRM',
    description: 'Opera leads, contactos, tareas, pipeline y carritos abandonados.',
    permissions: buildPresetPermissions([
      ['crm', ['dashboard', 'pipelineView', 'pipelineManage', 'contactsView', 'contactsEdit', 'eventsView', 'tasksView', 'tasksManage', 'abandonedView', 'abandonedManage', 'productInterestView']],
      ['orders', ['view']],
      ['products', ['view']],
      ['customers', ['view']]
    ])
  },
  {
    key: 'warehouse_interest',
    label: 'Bodega e interes',
    description: 'Consulta interes comercial por producto y alertas de stock.',
    permissions: buildPresetPermissions([
      ['products', ['view']],
      ['inventory', ['view']],
      ['crm', ['dashboard', 'productInterestView']]
    ])
  }
];

export const normalizePermissionMatrix = (rawPermissions, { fillMissing = false, defaultValue = false } = {}) => {
  const base = fillMissing ? createEmptyPermissionMatrix() : {};

  if (!rawPermissions || typeof rawPermissions !== 'object') {
    return base;
  }

  PERMISSION_CATALOG.forEach(group => {
    const incomingGroup = rawPermissions[group.module];
    if (!incomingGroup || typeof incomingGroup !== 'object') {
      if (fillMissing) {
        group.actions.forEach(action => {
          base[group.module][action.key] = defaultValue;
        });
      }
      return;
    }

    const nextGroup = fillMissing ? base[group.module] : {};
    group.actions.forEach(action => {
      if (incomingGroup[action.key] !== undefined) {
        nextGroup[action.key] = Boolean(incomingGroup[action.key]);
      } else if (fillMissing) {
        nextGroup[action.key] = defaultValue;
      }
    });

    if (!fillMissing && Object.keys(nextGroup).length) {
      base[group.module] = nextGroup;
    }
  });

  return base;
};

export const getRoleDefaultPermissions = role => {
  const defaults = ROLE_DEFAULTS[role] ?? {};
  return normalizePermissionMatrix(defaults, { fillMissing: true, defaultValue: false });
};

export const getPermissionPreset = presetKey => {
  const preset = PERMISSION_PRESETS.find(item => item.key === presetKey);
  if (!preset) {
    return null;
  }

  if (preset.permissions == null) {
    return {
      ...preset,
      permissions: getRoleDefaultPermissions('admin')
    };
  }

  return {
    ...preset,
    permissions: normalizePermissionMatrix(preset.permissions, {
      fillMissing: true,
      defaultValue: false
    })
  };
};

export const getEffectivePermissions = user => {
  const role = user?.role || (user?.isAdmin ? 'admin' : 'customer');

  if (role === 'superadmin') {
    return getRoleDefaultPermissions('superadmin');
  }

  const defaultPermissions = getRoleDefaultPermissions(role);
  const customPermissions = normalizePermissionMatrix(user?.permissions, {
    fillMissing: false
  });

  if (!Object.keys(customPermissions).length) {
    return defaultPermissions;
  }

  const merged = getRoleDefaultPermissions(role);
  Object.entries(customPermissions).forEach(([moduleKey, actionMap]) => {
    if (!merged[moduleKey]) {
      merged[moduleKey] = {};
    }
    Object.entries(actionMap).forEach(([actionKey, value]) => {
      merged[moduleKey][actionKey] = Boolean(value);
    });
  });

  return merged;
};

export const hasPermission = (user, moduleKey, actionKey) => {
  const role = user?.role || (user?.isAdmin ? 'admin' : 'customer');
  if (role === 'superadmin') {
    return true;
  }

  const effectivePermissions = user?.effectivePermissions || getEffectivePermissions(user);
  return Boolean(effectivePermissions?.[moduleKey]?.[actionKey]);
};

export const parsePermissionDescriptor = descriptor => {
  if (typeof descriptor !== 'string') {
    return { moduleKey: '', actionKey: '' };
  }

  const [moduleKey = '', actionKey = ''] = descriptor.split('.');
  return { moduleKey, actionKey };
};
