import express from 'express';
import {
  getFormDefinitions,
  getBrandingSettings,
  getHomeLayoutSettings,
  getPaymentMethods,
  getSystemSettings,
  getTextSettings,
  getThemeSettings
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
    catalogProfile: settings.catalogProfile,
    catalogProfileLabel: settings.catalogProfileLabel,
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
    logoPublicId: branding.logoPublicId,
    faviconPublicId: branding.faviconPublicId,
    navbarName: branding.navbarName,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    backgroundColor: branding.backgroundColor,
    textColor: branding.textColor,
    visualStyle: branding.visualStyle
  });
});

router.get('/home-layout', async (req, res) => {
  const homeLayout = await getHomeLayoutSettings();
  res.json({
    sections: Array.isArray(homeLayout.sections) ? homeLayout.sections : []
  });
});

router.get('/themes', async (req, res) => {
  const themes = await getThemeSettings();
  res.json(
    themes.map(theme => ({
      scope: theme.scope,
      label: theme.label,
      primaryColor: theme.primaryColor,
      accentColor: theme.accentColor,
      backgroundColor: theme.backgroundColor,
      surfaceColor: theme.surfaceColor,
      textColor: theme.textColor,
      headingColor: theme.headingColor,
      mutedColor: theme.mutedColor,
      fontBody: theme.fontBody,
      fontHeading: theme.fontHeading,
      buttonStyle: theme.buttonStyle,
      panelStyle: theme.panelStyle,
      formStyle: theme.formStyle,
      navStyle: theme.navStyle
    }))
  );
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

router.get('/forms', async (req, res) => {
  const forms = await getFormDefinitions({ scope: 'storefront', enabledOnly: true });
  res.json(forms);
});

router.get('/forms/:key', async (req, res) => {
  const forms = await getFormDefinitions({ scope: 'storefront', enabledOnly: true });
  const form = forms.find(item => item.key === req.params.key);

  if (!form) {
    return res.status(404).json({ message: 'Formulario no encontrado' });
  }

  return res.json(form);
});

export default router;
