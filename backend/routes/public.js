import express from 'express';
import {
  getBrandingSettings,
  getPaymentMethods,
  getSystemSettings,
  getTextSettings
} from '../services/systemConfigService.js';
import { getPublicModules, isModuleEnabled } from '../services/moduleAccessService.js';

const router = express.Router();

const sanitizeMap = value => {
  if (!value) return {};
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  return value;
};

const sanitizePaymentMethod = method => {
  const plain = method?.toObject ? method.toObject() : { ...(method || {}) };
  if ('whatsappNumber' in plain) {
    plain.whatsappNumber = '';
  }
  return plain;
};

router.get('/settings', async (req, res) => {
  const settings = await getSystemSettings();
  res.json({
    businessName: settings.businessName,
    tradeName: settings.tradeName,
    country: settings.country,
    currency: settings.currency,
    timezone: settings.timezone,
    contactEmail: settings.contactEmail,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    address: settings.address,
    socialLinks: sanitizeMap(settings.socialLinks),
    footerText: settings.footerText,
    enableInternalProductImages: Boolean(settings.enableInternalProductImages)
  });
});

router.get('/branding', async (req, res) => {
  const branding = await getBrandingSettings();
  res.json({
    logoUrl: branding.logoUrl,
    faviconUrl: branding.faviconUrl,
    navbarName: branding.navbarName,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    backgroundColor: branding.backgroundColor,
    textColor: branding.textColor,
    visualStyle: branding.visualStyle
  });
});

router.get('/payment-methods', async (req, res) => {
  const paymentsEnabled = await isModuleEnabled('payments');
  if (!paymentsEnabled) {
    return res.json([]);
  }

  const paymentMethods = await getPaymentMethods(true);
  res.json(paymentMethods.map(sanitizePaymentMethod));
});

router.get('/text-settings', async (req, res) => {
  const textSettings = await getTextSettings();
  res.json(textSettings.map(item => ({
    key: item.key,
    label: item.label,
    value: item.value,
    group: item.group,
    description: item.description
  })));
});

router.get('/modules', async (req, res) => {
  const modules = await getPublicModules();
  res.json(modules);
});

export default router;
