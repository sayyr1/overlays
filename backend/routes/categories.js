import express from 'express';
import Category from '../models/Category.js';
import { protect, adminOnly, requirePermission } from '../middleware/authMiddleware.js';
import { requireModuleEnabled } from '../middleware/moduleMiddleware.js';
import { hasPermission } from '../constants/permissions.js';

const router = express.Router();

router.use(requireModuleEnabled('categories'));

const DEFAULT_KEYS = ['brand', 'type', 'size', 'collection', 'gender', 'color'];
const normalizeEntry = value => String(value ?? '').trim();
const uniqueStrings = values => Array.from(new Set(values.map(normalizeEntry).filter(Boolean)));
const canManageBrandModels = user =>
  hasPermission(user, 'categories', 'manage') ||
  hasPermission(user, 'products', 'create') ||
  hasPermission(user, 'products', 'edit');

const ensureCategoryDocument = async () => {
  let doc = await Category.findOne();
  if (!doc) {
    const valuesByKey = {};
    DEFAULT_KEYS.forEach(key => {
      valuesByKey[key] = [];
    });
    doc = await Category.create({ valuesByKey, brandModels: {} });
    return doc;
  }

  let updated = false;
  DEFAULT_KEYS.forEach(key => {
    if (!doc.valuesByKey.has(key)) {
      doc.valuesByKey.set(key, []);
      updated = true;
    }
  });

  if (!doc.brandModels) {
    doc.brandModels = new Map();
    updated = true;
  }

  const brands = doc.valuesByKey.get('brand') || [];
  brands.forEach(brand => {
    if (!doc.brandModels.has(brand)) {
      doc.brandModels.set(brand, []);
      updated = true;
    }
  });

  if (updated) {
    await doc.save();
  }

  return doc;
};

const mapDocToResponse = doc => {
  const response = {};
  for (const [key, arr] of doc.valuesByKey.entries()) {
    response[key] = Array.isArray(arr) ? arr : [];
  }
  DEFAULT_KEYS.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(response, key)) {
      response[key] = [];
    }
  });
  return response;
};

const mapBrandModelsToResponse = doc => {
  const response = {};
  const brandModels = doc?.brandModels instanceof Map
    ? doc.brandModels
    : new Map(Object.entries(doc?.brandModels || {}));

  for (const [brand, models] of brandModels.entries()) {
    response[brand] = uniqueStrings(Array.isArray(models) ? models : []);
  }

  const brands = doc?.valuesByKey?.get?.('brand') || [];
  brands.forEach(brand => {
    if (!Object.prototype.hasOwnProperty.call(response, brand)) {
      response[brand] = [];
    }
  });

  return response;
};

router.get('/', async (req, res) => {
  try {
    const doc = await ensureCategoryDocument();
    res.json(mapDocToResponse(doc));
  } catch (error) {
    console.error('Error al obtener categorias:', error);
    res.status(500).json({ message: 'Error al obtener categorias' });
  }
});

router.get('/brand-models', async (req, res) => {
  try {
    const doc = await ensureCategoryDocument();
    res.json(mapBrandModelsToResponse(doc));
  } catch (error) {
    console.error('Error al obtener modelos por marca:', error);
    res.status(500).json({ message: 'Error al obtener modelos por marca' });
  }
});

router.post('/', protect, adminOnly, requirePermission('categories', 'manage'), async (req, res) => {
  const { key, value } = req.body || {};
  const trimmedKey = normalizeEntry(key);
  const trimmedValue = normalizeEntry(value);

  if (!trimmedKey || !trimmedValue) {
    return res.status(400).json({ message: 'Falta clave o valor' });
  }

  try {
    const doc = await ensureCategoryDocument();
    const current = uniqueStrings(doc.valuesByKey.get(trimmedKey) || []);
    if (!current.includes(trimmedValue)) {
      current.push(trimmedValue);
      doc.valuesByKey.set(trimmedKey, current);
    }
    if (trimmedKey === 'brand' && !doc.brandModels.has(trimmedValue)) {
      doc.brandModels.set(trimmedValue, []);
    }
    await doc.save();
    res.json(mapDocToResponse(doc));
  } catch (error) {
    console.error('Error al agregar categoria:', error);
    res.status(500).json({ message: 'Error al agregar categoria' });
  }
});

router.delete('/', protect, adminOnly, requirePermission('categories', 'manage'), async (req, res) => {
  const { key, value } = req.body || {};
  const trimmedKey = normalizeEntry(key);
  const trimmedValue = normalizeEntry(value);

  if (!trimmedKey || !trimmedValue) {
    return res.status(400).json({ message: 'Falta clave o valor' });
  }

  try {
    const doc = await ensureCategoryDocument();
    const values = doc.valuesByKey.get(trimmedKey) || [];
    const filtered = values.filter(item => item !== trimmedValue);

    if (filtered.length === values.length) {
      return res.status(404).json({ message: 'Valor no encontrado en la categoria' });
    }

    doc.valuesByKey.set(trimmedKey, uniqueStrings(filtered));
    if (trimmedKey === 'brand') {
      doc.brandModels.delete(trimmedValue);
    }
    await doc.save();
    res.json(mapDocToResponse(doc));
  } catch (error) {
    console.error('Error al eliminar categoria:', error);
    res.status(500).json({ message: 'Error al eliminar categoria' });
  }
});

router.post('/key', protect, adminOnly, requirePermission('categories', 'manage'), async (req, res) => {
  const { key } = req.body || {};
  const trimmedKey = normalizeEntry(key);
  if (!trimmedKey) {
    return res.status(400).json({ message: 'Falta el nombre de la clave' });
  }
  try {
    const doc = await ensureCategoryDocument();
    if (!doc.valuesByKey.has(trimmedKey)) {
      doc.valuesByKey.set(trimmedKey, []);
      await doc.save();
    }
    res.json(mapDocToResponse(doc));
  } catch (error) {
    console.error('Error al crear clave de categoria:', error);
    res.status(500).json({ message: 'Error al crear clave de categoria' });
  }
});

router.delete('/key', protect, adminOnly, requirePermission('categories', 'manage'), async (req, res) => {
  const { key } = req.body || {};
  const trimmedKey = normalizeEntry(key);
  if (!trimmedKey) {
    return res.status(400).json({ message: 'Falta el nombre de la clave' });
  }
  if (DEFAULT_KEYS.includes(trimmedKey)) {
    return res.status(400).json({ message: 'No se puede eliminar una clave por defecto' });
  }
  try {
    const doc = await ensureCategoryDocument();
    if (!doc.valuesByKey.has(trimmedKey)) {
      return res.status(404).json({ message: 'Clave no encontrada' });
    }
    doc.valuesByKey.delete(trimmedKey);
    await doc.save();
    res.json(mapDocToResponse(doc));
  } catch (error) {
    console.error('Error al eliminar clave de categoria:', error);
    res.status(500).json({ message: 'Error al eliminar clave de categoria' });
  }
});

router.post('/brand-models', protect, adminOnly, async (req, res) => {
  const brand = normalizeEntry(req.body?.brand);
  const model = normalizeEntry(req.body?.model);

  if (!brand || !model) {
    return res.status(400).json({ message: 'Marca y modelo son obligatorios' });
  }

  if (!canManageBrandModels(req.user)) {
    return res.status(403).json({
      message: 'Acceso denegado: permiso insuficiente',
      permission: 'categories.manage | products.create | products.edit'
    });
  }

  try {
    const doc = await ensureCategoryDocument();
    const brands = uniqueStrings(doc.valuesByKey.get('brand') || []);
    if (!brands.includes(brand)) {
      brands.push(brand);
      doc.valuesByKey.set('brand', brands);
    }

    const types = uniqueStrings(doc.valuesByKey.get('type') || []);
    if (!types.includes(model)) {
      types.push(model);
      doc.valuesByKey.set('type', types);
    }

    const currentModels = uniqueStrings(doc.brandModels.get(brand) || []);
    if (!currentModels.includes(model)) {
      currentModels.push(model);
      doc.brandModels.set(brand, currentModels);
    }

    await doc.save();
    res.json(mapBrandModelsToResponse(doc));
  } catch (error) {
    console.error('Error al agregar modelo por marca:', error);
    res.status(500).json({ message: 'Error al agregar modelo por marca' });
  }
});

router.delete('/brand-models', protect, adminOnly, requirePermission('categories', 'manage'), async (req, res) => {
  const brand = normalizeEntry(req.body?.brand);
  const model = normalizeEntry(req.body?.model);

  if (!brand || !model) {
    return res.status(400).json({ message: 'Marca y modelo son obligatorios' });
  }

  try {
    const doc = await ensureCategoryDocument();
    const currentModels = uniqueStrings(doc.brandModels.get(brand) || []);
    const filtered = currentModels.filter(item => item !== model);

    if (filtered.length === currentModels.length) {
      return res.status(404).json({ message: 'Modelo no encontrado para esta marca' });
    }

    doc.brandModels.set(brand, filtered);
    await doc.save();
    res.json(mapBrandModelsToResponse(doc));
  } catch (error) {
    console.error('Error al eliminar modelo por marca:', error);
    res.status(500).json({ message: 'Error al eliminar modelo por marca' });
  }
});

export default router;
