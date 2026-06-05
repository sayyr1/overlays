import express from 'express';
import {
  protect,
  superAdminOnly
} from '../middleware/authMiddleware.js';
import AuditLog from '../models/AuditLog.js';
import User, { INTERNAL_USER_ROLES, USER_ROLES } from '../models/User.js';
import SystemSettings from '../models/SystemSettings.js';
import BrandingSettings from '../models/BrandingSettings.js';
import ModuleConfig from '../models/ModuleConfig.js';
import PaymentMethod from '../models/PaymentMethod.js';
import TextSetting from '../models/TextSetting.js';
import {
  getBrandingSettings,
  getModuleConfigs,
  getPaymentMethods,
  getSystemSettings,
  getTextSettings
} from '../services/systemConfigService.js';
import { invalidateModuleCache } from '../services/moduleAccessService.js';
import { createAuditLog } from '../utils/auditLog.js';
import {
  PERMISSION_CATALOG,
  PERMISSION_PRESETS,
  ROLE_DEFINITIONS,
  getEffectivePermissions,
  getPermissionPreset,
  normalizePermissionMatrix
} from '../constants/permissions.js';

const router = express.Router();

const sanitizePaymentMethod = method => {
  const plain = method?.toObject ? method.toObject() : { ...(method || {}) };
  if ('whatsappNumber' in plain) {
    plain.whatsappNumber = '';
  }
  return plain;
};

const serializeAccessUser = user => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role || (user.isAdmin ? USER_ROLES.ADMIN : USER_ROLES.CUSTOMER),
  isAdmin: user.isAdmin,
  membershipLevel: user.membershipLevel,
  permissions: normalizePermissionMatrix(user.permissions, { fillMissing: false }),
  effectivePermissions: user.effectivePermissions || getEffectivePermissions(user)
});

router.use(protect, superAdminOnly);

router.get('/settings', async (req, res) => {
  const settings = await getSystemSettings();
  res.json(settings);
});

router.put('/settings', async (req, res) => {
  const settings = await getSystemSettings();
  const before = settings.toObject({ flattenMaps: true });

  const fields = [
    'businessName',
    'tradeName',
    'country',
    'currency',
    'timezone',
    'contactEmail',
    'phone',
    'whatsapp',
    'address',
    'footerText',
    'enableInternalProductImages'
  ];

  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      settings[field] = req.body[field];
    }
  });

  if (req.body.socialLinks && typeof req.body.socialLinks === 'object') {
    settings.socialLinks = req.body.socialLinks;
  }

  await settings.save();
  await createAuditLog(req, {
    action: 'update',
    entity: 'SystemSettings',
    entityId: settings._id,
    before,
    after: settings
  });

  res.json(settings);
});

router.get('/branding', async (req, res) => {
  const branding = await getBrandingSettings();
  res.json(branding);
});

router.put('/branding', async (req, res) => {
  const branding = await getBrandingSettings();
  const before = branding.toObject();
  const fields = [
    'logoUrl',
    'faviconUrl',
    'navbarName',
    'primaryColor',
    'secondaryColor',
    'backgroundColor',
    'textColor',
    'visualStyle'
  ];

  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      branding[field] = req.body[field];
    }
  });

  await branding.save();
  await createAuditLog(req, {
    action: 'update',
    entity: 'BrandingSettings',
    entityId: branding._id,
    before,
    after: branding
  });

  res.json(branding);
});

router.get('/modules', async (req, res) => {
  const modules = await getModuleConfigs();
  res.json(modules);
});

router.get('/access-control', async (req, res) => {
  const users = await User.find({
    role: { $in: INTERNAL_USER_ROLES }
  })
    .select('-password')
    .sort({ role: -1, name: 1, email: 1 });

  res.json({
    catalog: PERMISSION_CATALOG,
    roles: ROLE_DEFINITIONS.filter(role => INTERNAL_USER_ROLES.includes(role.key)),
    presets: PERMISSION_PRESETS.map(preset => ({
      key: preset.key,
      label: preset.label,
      description: preset.description
    })),
    users: users.map(serializeAccessUser)
  });
});

router.put('/access-control/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  if ((user.role || (user.isAdmin ? USER_ROLES.ADMIN : USER_ROLES.CUSTOMER)) === USER_ROLES.SUPERADMIN) {
    return res.status(400).json({ message: 'No se editan permisos de superadmin desde esta vista' });
  }

  if (!INTERNAL_USER_ROLES.includes(user.role || (user.isAdmin ? USER_ROLES.ADMIN : USER_ROLES.CUSTOMER))) {
    return res.status(400).json({ message: 'Solo se pueden configurar permisos para usuarios internos' });
  }

  const before = serializeAccessUser(user);
  const { permissions, useDefaultPermissions = false, presetKey = '' } = req.body || {};

  if (useDefaultPermissions) {
    user.permissions = undefined;
  } else if (presetKey) {
    const preset = getPermissionPreset(presetKey);
    if (!preset) {
      return res.status(400).json({ message: 'Preset de permisos no valido' });
    }
    user.permissions = normalizePermissionMatrix(preset.permissions, {
      fillMissing: true,
      defaultValue: false
    });
  } else {
    user.permissions = normalizePermissionMatrix(permissions, {
      fillMissing: true,
      defaultValue: false
    });
  }

  await user.save();
  user.effectivePermissions = getEffectivePermissions(user);

  await createAuditLog(req, {
    action: 'update',
    entity: 'UserPermissions',
    entityId: user._id,
    before,
    after: serializeAccessUser(user)
  });

  res.json(serializeAccessUser(user));
});

router.put('/modules/:key', async (req, res) => {
  const moduleConfig = await ModuleConfig.findOne({ key: req.params.key });
  if (!moduleConfig) {
    return res.status(404).json({ message: 'Módulo no encontrado' });
  }

  const before = moduleConfig.toObject();
  ['label', 'description', 'enabled', 'status', 'order'].forEach(field => {
    if (req.body[field] !== undefined) {
      moduleConfig[field] = req.body[field];
    }
  });

  await moduleConfig.save();
  invalidateModuleCache();
  await createAuditLog(req, {
    action: 'update',
    entity: 'ModuleConfig',
    entityId: moduleConfig._id,
    before,
    after: moduleConfig
  });

  res.json(moduleConfig);
});

router.get('/payment-methods', async (req, res) => {
  const paymentMethods = await getPaymentMethods(false);
  res.json(paymentMethods.map(sanitizePaymentMethod));
});

router.post('/payment-methods', async (req, res) => {
  const payload = {
    ...req.body,
    whatsappNumber: ''
  };
  const paymentMethod = await PaymentMethod.create(payload);
  await createAuditLog(req, {
    action: 'create',
    entity: 'PaymentMethod',
    entityId: paymentMethod._id,
    before: null,
    after: paymentMethod
  });
  res.status(201).json(sanitizePaymentMethod(paymentMethod));
});

router.put('/payment-methods/:id', async (req, res) => {
  const paymentMethod = await PaymentMethod.findById(req.params.id);
  if (!paymentMethod) {
    return res.status(404).json({ message: 'Método de pago no encontrado' });
  }

  const before = paymentMethod.toObject();
  [
    'name',
    'type',
    'enabled',
    'instructions',
    'bankName',
    'accountNumber',
    'accountOwner',
    'accountId',
    'accountType',
    'displayOrder'
  ].forEach(field => {
    if (req.body[field] !== undefined) {
      paymentMethod[field] = req.body[field];
    }
  });

  paymentMethod.whatsappNumber = '';

  await paymentMethod.save();
  await createAuditLog(req, {
    action: 'update',
    entity: 'PaymentMethod',
    entityId: paymentMethod._id,
    before,
    after: paymentMethod
  });

  res.json(sanitizePaymentMethod(paymentMethod));
});

router.delete('/payment-methods/:id', async (req, res) => {
  const paymentMethod = await PaymentMethod.findById(req.params.id);
  if (!paymentMethod) {
    return res.status(404).json({ message: 'Método de pago no encontrado' });
  }

  const before = paymentMethod.toObject();
  await paymentMethod.deleteOne();
  await createAuditLog(req, {
    action: 'delete',
    entity: 'PaymentMethod',
    entityId: paymentMethod._id,
    before,
    after: null
  });

  res.status(204).end();
});

router.get('/text-settings', async (req, res) => {
  const textSettings = await getTextSettings();
  res.json(textSettings);
});

router.put('/text-settings/:key', async (req, res) => {
  const textSetting = await TextSetting.findOne({ key: req.params.key });
  if (!textSetting) {
    return res.status(404).json({ message: 'Texto no encontrado' });
  }

  const before = textSetting.toObject();
  ['label', 'value', 'group', 'description'].forEach(field => {
    if (req.body[field] !== undefined) {
      textSetting[field] = req.body[field];
    }
  });

  await textSetting.save();
  await createAuditLog(req, {
    action: 'update',
    entity: 'TextSetting',
    entityId: textSetting._id,
    before,
    after: textSetting
  });

  res.json(textSetting);
});

router.get('/audit-logs', async (req, res) => {
  const auditLogs = await AuditLog.find()
    .populate('user', 'name email role')
    .sort({ createdAt: -1 })
    .limit(200);

  res.json(auditLogs);
});

export default router;
