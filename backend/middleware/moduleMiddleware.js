import { areModulesEnabled } from '../services/moduleAccessService.js';

export const requireModuleEnabled = (moduleKeys, options = {}) => async (req, res, next) => {
  const keys = Array.isArray(moduleKeys) ? moduleKeys : [moduleKeys];
  const mode = options.mode || 'all';

  try {
    const enabled = await areModulesEnabled(keys, { mode });
    if (enabled) {
      return next();
    }

    const joinedKeys = keys.join(', ');
    return res.status(403).json({
      message:
        options.message ||
        `Modulo no disponible: ${joinedKeys}`
    });
  } catch (error) {
    console.error('Error validando modulo habilitado:', error);
    return res.status(500).json({ message: 'No se pudo validar la configuracion del modulo' });
  }
};
