import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import multer from 'multer';
import {
  protect,
  superAdminOnly
} from '../middleware/authMiddleware.js';
import AuditLog from '../models/AuditLog.js';
import User, {
  INTERNAL_USER_ROLES,
  USER_ROLES,
  isSystemGeneratedEmail,
  normalizeUserEmail,
  normalizeUsername
} from '../models/User.js';
import SystemSettings from '../models/SystemSettings.js';
import BrandingSettings from '../models/BrandingSettings.js';
import ModuleConfig from '../models/ModuleConfig.js';
import PaymentMethod from '../models/PaymentMethod.js';
import TextSetting from '../models/TextSetting.js';
import ThemeSettings from '../models/ThemeSettings.js';
import FormDefinition from '../models/FormDefinition.js';
import cloudinary from '../utils/cloudinary.js';
import {
  applyCatalogProfile,
  getCatalogProfilesPayload
} from '../services/catalogProfileService.js';
import {
  getBrandingSettings,
  getHomeLayoutSettings,
  getFormDefinitions,
  getModuleConfigs,
  getPaymentMethods,
  getSystemSettings,
  getTextSettings,
  getThemeSettings
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
const PASSWORD_MIN_LENGTH = 6;
const FORM_FIELD_TYPES = new Set(['text', 'email', 'phone', 'textarea', 'select', 'radio', 'checkbox', 'number', 'date']);
const FORM_WIDTHS = new Set(['full', 'half', 'third']);
const FORM_LAYOUTS = new Set(['stacked', 'grid']);
const FORM_SCOPES = new Set(['storefront', 'admin', 'superadmin']);
const THEME_SCOPES = new Set(['storefront', 'admin', 'superadmin']);
const HOME_SECTION_TYPES = new Set(['hero', 'new_arrivals', 'featured_products', 'categories', 'brands', 'collections', 'origins']);
const THEME_FIELDS = [
  'label',
  'primaryColor',
  'accentColor',
  'backgroundColor',
  'surfaceColor',
  'textColor',
  'headingColor',
  'mutedColor',
  'fontBody',
  'fontHeading',
  'buttonStyle',
  'panelStyle',
  'formStyle',
  'navStyle'
];
const BRANDING_UPLOAD_FOLDER = String(process.env.CLOUDINARY_UPLOAD_FOLDER || 'storefront-assets').trim();
const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const createBuilderId = () => new mongoose.Types.ObjectId().toString();
const normalizeFormKey = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const sanitizeOptions = options =>
  (Array.isArray(options) ? options : [])
    .map(option => {
      const label = String(option?.label || '').trim();
      const value = String(option?.value || label).trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter(Boolean);

const sanitizeFormField = (field, index) => {
  const type = FORM_FIELD_TYPES.has(field?.type) ? field.type : 'text';
  const width = FORM_WIDTHS.has(field?.width) ? field.width : 'full';
  const settings = field?.settings && typeof field.settings === 'object' ? field.settings : {};

  return {
    id: String(field?.id || createBuilderId()),
    name: normalizeFormKey(field?.name || field?.label || `field_${index + 1}`),
    label: String(field?.label || `Campo ${index + 1}`).trim(),
    type,
    required: Boolean(field?.required),
    enabled: field?.enabled !== false,
    locked: Boolean(field?.locked),
    placeholder: String(field?.placeholder || '').trim(),
    helpText: String(field?.helpText || '').trim(),
    defaultValue: String(field?.defaultValue || '').trim(),
    width,
    order: Number.isFinite(field?.order) ? field.order : index,
    options: ['select', 'radio'].includes(type) ? sanitizeOptions(field?.options) : [],
    settings
  };
};

const sanitizeFormPayload = payload => {
  const title = String(payload?.title || '').trim();
  const key = normalizeFormKey(payload?.key || title);
  const scope = FORM_SCOPES.has(payload?.scope) ? payload.scope : 'storefront';
  const layout = FORM_LAYOUTS.has(payload?.layout) ? payload.layout : 'grid';
  const safeFields = Array.isArray(payload?.fields) ? payload.fields : [];

  return {
    key,
    title,
    description: String(payload?.description || '').trim(),
    scope,
    enabled: payload?.enabled !== false,
    submitLabel: String(payload?.submitLabel || 'Enviar').trim(),
    successMessage: String(payload?.successMessage || 'Formulario configurado correctamente.').trim(),
    layout,
    order: Number.isFinite(payload?.order) ? payload.order : 0,
    fields: safeFields.map(sanitizeFormField)
  };
};

const uploadBrandingAsset = file =>
  new Promise((resolve, reject) => {
    if (file?.path && file?.filename) {
      resolve({
        url: file.path,
        publicId: file.filename
      });
      return;
    }

    if (!file?.buffer) {
      reject(new Error('Archivo de logo invalido'));
      return;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: BRANDING_UPLOAD_FOLDER,
        resource_type: 'image'
      },
      (error, result) => {
        if (error || !result?.secure_url || !result?.public_id) {
          reject(error || new Error('Cloudinary no devolvio una respuesta valida'));
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id
        });
      }
    );

    uploadStream.end(file.buffer);
  });

const uploadBrandingDataUrl = dataUrl =>
  cloudinary.uploader.upload(dataUrl, {
    folder: BRANDING_UPLOAD_FOLDER,
    resource_type: 'image'
  }).then(result => {
    if (!result?.secure_url || !result?.public_id) {
      throw new Error('Cloudinary no devolvio una respuesta valida');
    }

    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  });

const sanitizePaymentMethod = method => {
  const plain = method?.toObject ? method.toObject() : { ...(method || {}) };
  if ('whatsappNumber' in plain) {
    plain.whatsappNumber = '';
  }
  return plain;
};

const sanitizeThemePayload = payload => {
  const next = {};

  THEME_FIELDS.forEach(field => {
    if (payload?.[field] !== undefined) {
      next[field] = payload[field];
    }
  });

  return next;
};

const sanitizeHomeSectionSettings = (type, settings) => {
  const safeSettings = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};

  if (type !== 'hero') {
    return {};
  }

  return {
    title: String(safeSettings.title || '').trim(),
    eyebrow: String(safeSettings.eyebrow || '').trim(),
    description: String(safeSettings.description || '').trim(),
    primaryCtaLabel: String(safeSettings.primaryCtaLabel || '').trim(),
    primaryCtaTo: String(safeSettings.primaryCtaTo || '').trim(),
    secondaryCtaLabel: String(safeSettings.secondaryCtaLabel || '').trim(),
    secondaryCtaTo: String(safeSettings.secondaryCtaTo || '').trim()
  };
};

const sanitizeHomeSection = (section, index) => {
  const type = HOME_SECTION_TYPES.has(section?.type) ? section.type : null;
  if (!type) {
    return null;
  }

  return {
    id: String(section?.id || createBuilderId()),
    type,
    enabled: section?.enabled !== false,
    title: String(section?.title || '').trim(),
    eyebrow: String(section?.eyebrow || '').trim(),
    linkTo: String(section?.linkTo || '').trim(),
    linkLabel: String(section?.linkLabel || '').trim(),
    limit: Number.isFinite(section?.limit) ? Math.max(0, Math.min(24, Number(section.limit))) : 6,
    order: Number.isFinite(section?.order) ? section.order : index,
    settings: sanitizeHomeSectionSettings(type, section?.settings)
  };
};

const sanitizeHomeLayoutPayload = payload => ({
  sections: (Array.isArray(payload?.sections) ? payload.sections : [])
    .map(sanitizeHomeSection)
    .filter(Boolean)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((section, index) => ({
      ...section,
      order: index
    }))
});

const serializeAccessUser = user => ({
  _id: user._id,
  name: user.name,
  username: user.username || normalizeUsername(user.email?.split('@')[0] || user.name || 'usuario'),
  email: isSystemGeneratedEmail(user.email) ? '' : user.email,
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
    'catalogProfile',
    'catalogProfileLabel',
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

router.get('/catalog-profiles', async (req, res) => {
  const payload = await getCatalogProfilesPayload();
  res.json(payload);
});

router.post('/catalog-profiles/apply', async (req, res) => {
  const presetKey = String(req.body?.presetKey || '').trim() || 'footwear';
  const mode = String(req.body?.mode || '').trim() || 'merge';
  const settings = await getSystemSettings();
  const before = settings.toObject({ flattenMaps: true });

  try {
    const result = await applyCatalogProfile({ presetKey, mode });

    await createAuditLog(req, {
      action: 'update',
      entity: 'CatalogProfile',
      entityId: result.settings?._id || settings._id,
      before,
      after: {
        catalogProfile: result.preset,
        mode: result.mode,
        stats: result.stats
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Error applying catalog profile', error);
    res.status(500).json({ message: 'No se pudo aplicar el perfil de catalogo.' });
  }
});

router.get('/branding', async (req, res) => {
  const branding = await getBrandingSettings();
  res.json(branding);
});

router.get('/home-layout', async (req, res) => {
  const homeLayout = await getHomeLayoutSettings();
  res.json(homeLayout);
});

router.put('/home-layout', async (req, res) => {
  const homeLayout = await getHomeLayoutSettings();
  const before = homeLayout.toObject();
  const payload = sanitizeHomeLayoutPayload(req.body);

  homeLayout.sections = payload.sections;
  await homeLayout.save();

  await createAuditLog(req, {
    action: 'update',
    entity: 'HomeLayoutSettings',
    entityId: homeLayout._id,
    before,
    after: homeLayout
  });

  res.json(homeLayout);
});

router.post('/branding/upload-logo', brandingUpload.single('logo'), async (req, res) => {
  try {
    const uploadedLogo = await uploadBrandingAsset(req.file);
    const branding = await getBrandingSettings();
    const before = branding.toObject();
    const previousLogoPublicId = String(branding.logoPublicId || '').trim();

    branding.logoUrl = uploadedLogo.url;
    branding.logoPublicId = uploadedLogo.publicId;
    branding.faviconUrl = cloudinary.url(uploadedLogo.publicId, {
      secure: true,
      format: 'png',
      transformation: [
        {
          width: 64,
          height: 64,
          crop: 'fit'
        }
      ]
    });
    branding.faviconPublicId = uploadedLogo.publicId;

    await branding.save();

    if (previousLogoPublicId && previousLogoPublicId !== uploadedLogo.publicId) {
      cloudinary.uploader.destroy(previousLogoPublicId).catch(error => {
        console.error('No se pudo eliminar el logo anterior de Cloudinary', error);
      });
    }

    await createAuditLog(req, {
      action: 'update',
      entity: 'BrandingSettings',
      entityId: branding._id,
      before,
      after: branding
    });

    res.json(branding);
  } catch (error) {
    console.error('Error subiendo logo de branding:', error);
    res.status(500).json({ message: 'No se pudo subir el logo.' });
  }
});

router.put('/branding', async (req, res) => {
  const branding = await getBrandingSettings();
  const before = branding.toObject();
  const previousLogoPublicId = String(branding.logoPublicId || '').trim();
  const fields = [
    'logoUrl',
    'logoPublicId',
    'faviconUrl',
    'faviconPublicId',
    'navbarName',
    'primaryColor',
    'secondaryColor',
    'backgroundColor',
    'textColor',
    'visualStyle'
  ];

  if (typeof req.body?.logoDataUrl === 'string' && req.body.logoDataUrl.trim()) {
    try {
      const uploadedLogo = await uploadBrandingDataUrl(req.body.logoDataUrl.trim());
      branding.logoUrl = uploadedLogo.url;
      branding.logoPublicId = uploadedLogo.publicId;
      branding.faviconUrl = cloudinary.url(uploadedLogo.publicId, {
        secure: true,
        format: 'png',
        transformation: [
          {
            width: 64,
            height: 64,
            crop: 'fit'
          }
        ]
      });
      branding.faviconPublicId = uploadedLogo.publicId;
    } catch (error) {
      console.error('Error subiendo logo desde branding PUT:', error);
      return res.status(500).json({ message: 'No se pudo subir el logo.' });
    }
  }

  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      branding[field] = req.body[field];
    }
  });

  await branding.save();

  if (
    previousLogoPublicId &&
    previousLogoPublicId !== branding.logoPublicId &&
    !String(req.body?.keepPreviousLogo || '').trim()
  ) {
    cloudinary.uploader.destroy(previousLogoPublicId).catch(error => {
      console.error('No se pudo eliminar el logo anterior de Cloudinary', error);
    });
  }

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

router.get('/themes', async (req, res) => {
  const themes = await getThemeSettings();
  res.json(themes);
});

router.put('/themes/:scope', async (req, res) => {
  const scope = String(req.params.scope || '').trim();

  if (!THEME_SCOPES.has(scope)) {
    return res.status(400).json({ message: 'Scope de tema no valido' });
  }

  const theme = await ThemeSettings.findOne({ scope });
  if (!theme) {
    return res.status(404).json({ message: 'Tema no encontrado' });
  }

  const before = theme.toObject();
  const sanitized = sanitizeThemePayload(req.body);

  THEME_FIELDS.forEach(field => {
    if (sanitized[field] !== undefined) {
      theme[field] = sanitized[field];
    }
  });

  await theme.save();
  await createAuditLog(req, {
    action: 'update',
    entity: 'ThemeSettings',
    entityId: theme._id,
    before,
    after: theme
  });

  res.json(theme);
});

router.post('/access-control/users', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const username = normalizeUsername(req.body?.username);
    const email = normalizeUserEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const role = String(req.body?.role || '');

    if (!name) {
      return res.status(400).json({ message: 'El nombre es obligatorio' });
    }

    if (!username) {
      return res.status(400).json({ message: 'El nombre de usuario es obligatorio' });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        message: `La contrasena debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
      });
    }

    if (![USER_ROLES.SALES, USER_ROLES.OWNER, USER_ROLES.SUPERADMIN].includes(role)) {
      return res.status(400).json({ message: 'Rol interno no valido para creacion' });
    }

    const existingUsers = await User.find({
      $or: [
        { username },
        ...(email ? [{ email }] : [])
      ]
    }).select('username email');

    if (existingUsers.some(user => user.username === username)) {
      return res.status(400).json({ message: 'El nombre de usuario ya existe' });
    }

    if (email && existingUsers.some(user => user.email === email)) {
      return res.status(400).json({ message: 'El correo ya existe' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username,
      email,
      password: passwordHash,
      role
    });

    const serialized = serializeAccessUser(user);
    await createAuditLog(req, {
      action: 'create',
      entity: 'InternalUser',
      entityId: user._id,
      before: null,
      after: serialized
    });

    res.status(201).json(serialized);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudo crear el usuario interno' });
  }
});

router.get('/access-control', async (req, res) => {
  const users = await User.find({
    role: { $in: INTERNAL_USER_ROLES }
  })
    .select('-password')
    .sort({ role: -1, name: 1, username: 1 });

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

router.get('/forms', async (req, res) => {
  const forms = await getFormDefinitions();
  res.json(forms);
});

router.post('/forms', async (req, res) => {
  const sanitized = sanitizeFormPayload(req.body);

  if (!sanitized.title) {
    return res.status(400).json({ message: 'El titulo del formulario es obligatorio' });
  }

  if (!sanitized.key) {
    return res.status(400).json({ message: 'La clave del formulario es obligatoria' });
  }

  const existing = await FormDefinition.findOne({ key: sanitized.key });
  if (existing) {
    return res.status(400).json({ message: 'La clave del formulario ya existe' });
  }

  const form = await FormDefinition.create(sanitized);
  await createAuditLog(req, {
    action: 'create',
    entity: 'FormDefinition',
    entityId: form._id,
    before: null,
    after: form
  });

  res.status(201).json(form);
});

router.put('/forms/:key', async (req, res) => {
  const form = await FormDefinition.findOne({ key: req.params.key });
  if (!form) {
    return res.status(404).json({ message: 'Formulario no encontrado' });
  }

  const sanitized = sanitizeFormPayload(req.body);
  if (!sanitized.title) {
    return res.status(400).json({ message: 'El titulo del formulario es obligatorio' });
  }

  if (!sanitized.key) {
    return res.status(400).json({ message: 'La clave del formulario es obligatoria' });
  }

  const conflicting = await FormDefinition.findOne({
    key: sanitized.key,
    _id: { $ne: form._id }
  }).select('_id');

  if (conflicting) {
    return res.status(400).json({ message: 'La clave del formulario ya existe' });
  }

  const before = form.toObject();
  Object.assign(form, sanitized);
  await form.save();

  await createAuditLog(req, {
    action: 'update',
    entity: 'FormDefinition',
    entityId: form._id,
    before,
    after: form
  });

  res.json(form);
});

router.delete('/forms/:key', async (req, res) => {
  const form = await FormDefinition.findOne({ key: req.params.key });
  if (!form) {
    return res.status(404).json({ message: 'Formulario no encontrado' });
  }

  const before = form.toObject();
  await form.deleteOne();
  await createAuditLog(req, {
    action: 'delete',
    entity: 'FormDefinition',
    entityId: form._id,
    before,
    after: null
  });

  res.status(204).end();
});

router.get('/audit-logs', async (req, res) => {
  const auditLogs = await AuditLog.find()
    .populate('user', 'name email role')
    .sort({ createdAt: -1 })
    .limit(200);

  res.json(auditLogs);
});

export default router;
