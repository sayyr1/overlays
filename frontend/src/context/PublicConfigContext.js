import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from '../api/axiosInstance';

const PublicConfigContext = createContext(null);
const ALL_SECTIONS = ['settings', 'branding', 'paymentMethods', 'textSettings', 'modules'];

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

const applyBrandingToDocument = branding => {
  if (typeof document === 'undefined' || !branding) return;
  const root = document.documentElement;
  root.style.setProperty('--primary-color', branding.primaryColor || '#0f766e');
  root.style.setProperty('--secondary-color', branding.secondaryColor || '#111827');
  root.style.setProperty('--background-color', branding.backgroundColor || '#0b1220');
  root.style.setProperty('--text-color', branding.textColor || '#0f172a');

  if (branding.faviconUrl) {
    const existing = document.querySelector("link[rel='icon']");
    if (existing) {
      existing.href = branding.faviconUrl;
    }
  }
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

  return null;
};

export const PublicConfigProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [branding, setBranding] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [textSettings, setTextSettings] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  const applySectionValue = useCallback((section, data) => {
    if (section === 'settings') setSettings(data);
    if (section === 'branding') setBranding(data);
    if (section === 'paymentMethods') setPaymentMethods(Array.isArray(data) ? data : []);
    if (section === 'textSettings') setTextSettings(Array.isArray(data) ? data : []);
    if (section === 'modules') setModules(Array.isArray(data) ? data : []);
  }, []);

  const clearSectionValue = useCallback(section => {
    if (section === 'settings') setSettings(null);
    if (section === 'branding') setBranding(null);
    if (section === 'paymentMethods') setPaymentMethods([]);
    if (section === 'textSettings') setTextSettings([]);
    if (section === 'modules') setModules([]);
  }, []);

  const loadPublicConfig = useCallback(async (sections = ALL_SECTIONS, options = {}) => {
    const normalizedSections = Array.isArray(sections) ? sections : [sections];
    const shouldSetLoading = options.setLoading ?? true;

    if (shouldSetLoading) {
      setLoading(true);
    }

    try {
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
  }, [applySectionValue, clearSectionValue]);

  useEffect(() => {
    loadPublicConfig();
  }, [loadPublicConfig]);

  useEffect(() => {
    applyBrandingToDocument(branding);
  }, [branding]);

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

  const setPublicModules = useCallback(nextModules => {
    setModules(sortModules(Array.isArray(nextModules) ? nextModules : []));
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
      paymentMethods,
      textSettings,
      modules,
      moduleMap,
      textMap: toTextMap(textSettings),
      loading,
      reload: loadPublicConfig,
      reloadSection: section => loadPublicConfig(section, { setLoading: false }),
      isModuleEnabled,
      areModulesEnabled,
      setPublicSettings,
      setPublicBranding,
      setPublicModules,
      upsertPublicModule,
      upsertPublicPaymentMethod,
      removePublicPaymentMethod,
      upsertPublicTextSetting
    }),
    [
      settings,
      branding,
      paymentMethods,
      textSettings,
      modules,
      moduleMap,
      loading,
      loadPublicConfig,
      isModuleEnabled,
      areModulesEnabled,
      setPublicSettings,
      setPublicBranding,
      setPublicModules,
      upsertPublicModule,
      upsertPublicPaymentMethod,
      removePublicPaymentMethod,
      upsertPublicTextSetting
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
