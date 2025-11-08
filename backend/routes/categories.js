import express from 'express';
import Category from '../models/Category.js';

const router = express.Router();

// Default keys to bootstrap and optionally protect from deletion
const DEFAULT_KEYS = ['brand', 'type', 'size', 'collection', 'gender', 'color'];

const ensureCategoryDocument = async () => {
  let doc = await Category.findOne();
  if (!doc) {
    const valuesByKey = {};
    DEFAULT_KEYS.forEach(key => {
      valuesByKey[key] = [];
    });
    doc = await Category.create({ valuesByKey });
    return doc;
  }

  let updated = false;
  DEFAULT_KEYS.forEach(key => {
    if (!doc.valuesByKey.has(key)) {
      doc.valuesByKey.set(key, []);
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
  // include all keys present in the map
  for (const [key, arr] of doc.valuesByKey.entries()) {
    response[key] = Array.isArray(arr) ? arr : [];
  }
  // ensure defaults are present at least as empty arrays
  DEFAULT_KEYS.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(response, key)) {
      response[key] = [];
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

// Add a value to a key (creates the key if missing)
router.post('/', async (req, res) => {
  const { key, value } = req.body || {};
  const trimmedKey = (key ?? '').toString().trim();
  const trimmedValue = (value ?? '').toString().trim();

  if (!trimmedKey || !trimmedValue) {
    return res.status(400).json({ message: 'Falta clave o valor' });
  }

  try {
    const doc = await ensureCategoryDocument();
    const current = doc.valuesByKey.get(trimmedKey) || [];
    if (!current.includes(trimmedValue)) {
      current.push(trimmedValue);
      doc.valuesByKey.set(trimmedKey, current);
      await doc.save();
    }
    res.json(mapDocToResponse(doc));
  } catch (error) {
    console.error('Error al agregar categoria:', error);
    res.status(500).json({ message: 'Error al agregar categoria' });
  }
});

// Remove a value from a key
router.delete('/', async (req, res) => {
  const { key, value } = req.body || {};
  const trimmedKey = (key ?? '').toString().trim();
  const trimmedValue = (value ?? '').toString().trim();

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

    doc.valuesByKey.set(trimmedKey, filtered);
    await doc.save();

    res.json(mapDocToResponse(doc));
  } catch (error) {
    console.error('Error al eliminar categoria:', error);
    res.status(500).json({ message: 'Error al eliminar categoria' });
  }
});

// Create a new category key (empty values)
router.post('/key', async (req, res) => {
  const { key } = req.body || {};
  const trimmedKey = (key ?? '').toString().trim();
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

// Delete a category key entirely (protect defaults)
router.delete('/key', async (req, res) => {
  const { key } = req.body || {};
  const trimmedKey = (key ?? '').toString().trim();
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

export default router;
