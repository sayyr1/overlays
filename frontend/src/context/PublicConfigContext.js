import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from '../api/axiosInstance';

const PublicConfigContext = createContext(null);
const ALL_SECTIONS = ['settings', 'branding', 'homeLayout', 'paymentMethods', 'textSettings', 'modules', 'themes'];

const toTextMap = items =>
  Array.isArray(items)
    ? items.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {})
    : {};

const toModuleMap = items =>
  Array.isArray(items)
    ? items.reduce((acc, item) => {
        acc[item.key] = item;
        return acc;
      }, {})
    : {};

const sortPaymentMethods = items =>
  [...items].sort(
    (a, b) =>
      (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
      (a.name || '').localeCompare(b.name || '')
  );

const sortTextSettings = items =>
  [...items].sort(
    (a, b) =>
      (a.group || '').localeCompare(b.group || '') ||
      (a.label || '').localeCompare(b.label || '')
  );

const sortModules = items =>
  [...items].sort(
    (a, b) =>
      (a.order ?? 0) - (b.order ?? 0) ||
      (a.label || '').localeCompare(b.label || '')
  );

const LEGACY_STORE_NAMES = new Set([
  'tu tienda',
  'tu negocio'
]);

const pickConfiguredName = (...values) => {
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) continue;
    if (LEGACY_STORE_NAMES.has(normalized.toLowerCase())) continue;
    return normalized;
  }
  return '';
};

const resolveStoreName = (settings, branding) =>
  pickConfiguredName(
    branding?.navbarName,
    settings?.tradeName,
    settings?.businessName
  ) || 'Tu tienda';

const applyBrandingToDocument = branding => {
  if (typeof document === 'undefined' || !branding) return;

  if (branding.faviconUrl) {
    let existing = document.querySelector("link[rel='icon']");
    if (!existing) {
      existing = document.createElement('link');
      existing.setAttribute('rel', 'icon');
      document.head.appendChild(existing);
    }
    existing.href = branding.faviconUrl;
  }
};

const applyStoreNameToDocument = storeName => {
  if (typeof document === 'undefined') return;
  const normalized = storeName?.trim() || 'Tu tienda';
  document.title = normalized;
};

const readBootstrap = async () => {
  const { data } = await axios.get('/api/public/bootstrap');
  return data || {};
};

const readSection = async section => {
  if (section === 'settings') {
    const { data } = await axios.get('/api/public/settings');
    return data || null;
  }

  if (section === 'branding') {
    const { data } = await axios.get('/api/public/branding');
    return data || null;
  }

  if (section === 'homeLayout') {
    const { data } = await axios.get('/api/public/home-layout');
    return data || { sections: [] };
  }

  if (section === 'paymentMethods') {
    const { data } = await axios.get('/api/public/payment-methods');
    return sortPaymentMethods(Array.isArray(data) ? data : []);
  }

  if (section === 'textSettings') {
    const { data } = await axios.get('/api/public/text-settings');
    return sortTextSettings(Array.isArray(data) ? data : []);
  }

  if (section === 'modules') {
    const { data } = await axios.get('/api/public/modules');
    return sortModules(Array.isArray(data) ? data : []);
  }

  if (section === 'themes') {
    const { data } = await axios.get('/api/public/themes');
    return Array.isArray(data) ? data : [];
  }

  return null;
};

export const PublicConfigProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [branding, setBranding] = useState(null);
  const [homeLayout, setHomeLayout] = useState({ sections: [] });
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [textSettings, setTextSettings] = useState([]);
  const [modules, setModules] = useState([]);
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);

  const applySectionValue = useCallback((section, data) => {
    if (section === 'settings') setSettings(data);
    if (section === 'branding') setBranding(data);
    if (section === 'homeLayout') setHomeLayout(data || { sections: [] });
    if (section === 'paymentMethods') setPaymentMethods(Array.isArray(data) ? data : []);
    if (section === 'textSettings') setTextSettings(Array.isArray(data) ? data : []);
    if (section === 'modules') setModules(Array.isArray(data) ? data : []);
    if (section === 'themes') setThemes(Array.isArray(data) ? data : []);
  }, []);

  const clearSectionValue = useCallback(section => {
    if (section === 'settings') setSettings(null);
    if (section === 'branding') setBranding(null);
    if (section === 'homeLayout') setHomeLayout({ sections: [] });
    if (section === 'paymentMethods') setPaymentMethods([]);
    if (section === 'textSettings') setTextSettings([]);
    if (section === 'modules') setModules([]);
    if (section === 'themes') setThemes([]);
  }, []);

  const applyBootstrapData = useCallback(payload => {
    setSettings(payload?.settings || null);
    setBranding(payload?.branding || null);
    setHomeLayout(payload?.homeLayout || { sections: [] });
    setPaymentMethods(sortPaymentMethods(Array.isArray(payload?.paymentMethods) ? payload.paymentMethods : []));
    setTextSettings(sortTextSettings(Array.isArray(payload?.textSettings) ? payload.textSettings : []));
    setModules(sortModules(Array.isArray(payload?.modules) ? payload.modules : []));
    setThemes(Array.isArray(payload?.themes) ? payload.themes : []);
  }, []);

  const loadPublicConfig = useCallback(async (sections = ALL_SECTIONS, options = {}) => {
    const normalizedSections = Array.isArray(sections) ? sections : [sections];
    const shouldSetLoading = options.setLoading ?? true;
    const shouldUseBootstrap =
      normalizedSections.length === ALL_SECTIONS.length &&
      ALL_SECTIONS.every(section => normalizedSections.includes(section));

    if (shouldSetLoading) {
      setLoading(true);
    }

    try {
      if (shouldUseBootstrap) {
        const payload = await readBootstrap();
        applyBootstrapData(payload);
        return;
      }

      const responses = await Promise.allSettled(
        normalizedSections.map(async section => ({
          section,
          data: await readSection(section)
        }))
      );

      responses.forEach((result, index) => {
        const section = normalizedSections[index];
        if (result.status === 'fulfilled') {
          applySectionValue(result.value.section, result.value.data);
          return;
        }

        console.error(`No se pudo cargar la seccion publica ${section}`, result.reason);
        clearSectionValue(section);
      });
    } finally {
      if (shouldSetLoading) {
        setLoading(false);
      }
    }
  }, [applyBootstrapData, applySectionValue, clearSectionValue]);

  useEffect(() => {
    loadPublicConfig();
  }, [loadPublicConfig]);

  useEffect(() => {
    applyBrandingToDocument(branding);
  }, [branding]);

  useEffect(() => {
    applyStoreNameToDocument(resolveStoreName(settings, branding));
  }, [branding, settings]);

  const moduleMap = useMemo(() => toModuleMap(modules), [modules]);

  const isModuleEnabled = useCallback(
    key => Boolean(moduleMap[key]?.isActive),
    [moduleMap]
  );

  const areModulesEnabled = useCallback(
    (keys, mode = 'all') => {
      const normalized = Array.isArray(keys) ? keys : [keys];
      const results = normalized.map(key => isModuleEnabled(key));
      return mode === 'any' ? results.some(Boolean) : results.every(Boolean);
    },
    [isModuleEnabled]
  );

  const setPublicSettings = useCallback(nextSettings => {
    setSettings(nextSettings || null);
  }, []);

  const setPublicBranding = useCallback(nextBranding => {
    setBranding(nextBranding || null);
  }, []);

  const setPublicHomeLayout = useCallback(nextHomeLayout => {
    setHomeLayout(nextHomeLayout || { sections: [] });
  }, []);

  const setPublicModules = useCallback(nextModules => {
    setModules(sortModules(Array.isArray(nextModules) ? nextModules : []));
  }, []);

  const setPublicThemes = useCallback(nextThemes => {
    setThemes(Array.isArray(nextThemes) ? nextThemes : []);
  }, []);

  const upsertPublicTheme = useCallback(nextTheme => {
    if (!nextTheme?.scope) return;
    setThemes(prev => {
      const filtered = prev.filter(item => item.scope !== nextTheme.scope);
      return [...filtered, nextTheme].sort((left, right) => left.scope.localeCompare(right.scope));
    });
  }, []);

  const upsertPublicModule = useCallback(nextModule => {
    if (!nextModule?.key) return;
    setModules(prev =>
      sortModules([
        ...prev.filter(item => item.key !== nextModule.key),
        nextModule
      ])
    );
  }, []);

  const upsertPublicPaymentMethod = useCallback(nextMethod => {
    if (!nextMethod?._id) return;
    setPaymentMethods(prev => {
      const filtered = prev.filter(item => item._id !== nextMethod._id);
      return nextMethod.enabled ? sortPaymentMethods([...filtered, nextMethod]) : filtered;
    });
  }, []);

  const removePublicPaymentMethod = useCallback(methodId => {
    setPaymentMethods(prev => prev.filter(item => item._id !== methodId));
  }, []);

  const upsertPublicTextSetting = useCallback(nextItem => {
    if (!nextItem?.key) return;
    setTextSettings(prev => {
      const exists = prev.some(item => item.key === nextItem.key);
      const nextValues = exists
        ? prev.map(item => (item.key === nextItem.key ? { ...item, ...nextItem } : item))
        : [...prev, nextItem];
      return sortTextSettings(nextValues);
    });
  }, []);

  const value = useMemo(
    () => ({
      settings,
      branding,
      homeLayout,
      storeName: resolveStoreName(settings, branding),
      businessName: settings?.businessName?.trim() || settings?.tradeName?.trim() || 'Tu negocio',
      paymentMethods,
      textSettings,
      modules,
      themes,
      moduleMap,
      textMap: toTextMap(textSettings),
      loading,
      reload: loadPublicConfig,
      reloadSection: section => loadPublicConfig(section, { setLoading: false }),
      isModuleEnabled,
      areModulesEnabled,
      setPublicSettings,
      setPublicBranding,
      setPublicHomeLayout,
      setPublicModules,
      setPublicThemes,
      upsertPublicModule,
      upsertPublicPaymentMethod,
      removePublicPaymentMethod,
      upsertPublicTextSetting,
      upsertPublicTheme
    }),
    [
      settings,
      branding,
      homeLayout,
      paymentMethods,
      textSettings,
      modules,
      themes,
      moduleMap,
      loading,
      loadPublicConfig,
      isModuleEnabled,
      areModulesEnabled,
      setPublicSettings,
      setPublicBranding,
      setPublicHomeLayout,
      setPublicModules,
      setPublicThemes,
      upsertPublicModule,
      upsertPublicPaymentMethod,
      removePublicPaymentMethod,
      upsertPublicTextSetting,
      upsertPublicTheme
    ]
  );

  return <PublicConfigContext.Provider value={value}>{children}</PublicConfigContext.Provider>;
};

export const usePublicConfig = () => {
  const context = useContext(PublicConfigContext);
  if (!context) {
    throw new Error('usePublicConfig must be used within a PublicConfigProvider');
  }
  return context;
};
