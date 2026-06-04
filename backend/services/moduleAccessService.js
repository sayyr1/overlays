import ModuleConfig from '../models/ModuleConfig.js';

const MODULE_CACHE_TTL_MS = 15 * 1000;

let cachedModules = null;
let cacheExpiresAt = 0;

const sortModules = modules =>
  [...modules].sort(
    (a, b) =>
      (a.order ?? 0) - (b.order ?? 0) ||
      (a.label || '').localeCompare(b.label || '')
  );

const isModuleActiveRecord = moduleItem =>
  Boolean(moduleItem?.enabled) && moduleItem?.status === 'active';

export const invalidateModuleCache = () => {
  cachedModules = null;
  cacheExpiresAt = 0;
};

export const getAllModules = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();
  if (!forceRefresh && cachedModules && now < cacheExpiresAt) {
    return cachedModules;
  }

  const modules = await ModuleConfig.find().lean();
  cachedModules = sortModules(modules);
  cacheExpiresAt = now + MODULE_CACHE_TTL_MS;
  return cachedModules;
};

export const getModuleMap = async options => {
  const modules = await getAllModules(options);
  return modules.reduce((acc, moduleItem) => {
    acc[moduleItem.key] = {
      ...moduleItem,
      isActive: isModuleActiveRecord(moduleItem)
    };
    return acc;
  }, {});
};

export const isModuleEnabled = async (moduleKey, options) => {
  const moduleMap = await getModuleMap(options);
  return Boolean(moduleMap[moduleKey]?.isActive);
};

export const areModulesEnabled = async (moduleKeys, { mode = 'all', ...options } = {}) => {
  const keys = Array.isArray(moduleKeys) ? moduleKeys : [moduleKeys];
  const moduleMap = await getModuleMap(options);
  const results = keys.map(key => Boolean(moduleMap[key]?.isActive));

  return mode === 'any' ? results.some(Boolean) : results.every(Boolean);
};

export const getPublicModules = async options => {
  const modules = await getAllModules(options);
  return modules.map(moduleItem => ({
    key: moduleItem.key,
    label: moduleItem.label,
    description: moduleItem.description,
    enabled: Boolean(moduleItem.enabled),
    status: moduleItem.status,
    order: moduleItem.order,
    isActive: isModuleActiveRecord(moduleItem)
  }));
};
