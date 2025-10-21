import express from 'express';
import Category from '../models/Category.js';

const router = express.Router();

const CATEGORY_KEYS = ['brand', 'type', 'size', 'collection', 'gender', 'color'];

const ensureCategoryDocument = async () => {
  let doc = await Category.findOne();
  if (!doc) {
    const valuesByKey = {};
    CATEGORY_KEYS.forEach(key => {
      valuesByKey[key] = [];
    });
    doc = await Category.create({ valuesByKey });
    return doc;
  }

  let updated = false;
  CATEGORY_KEYS.forEach(key => {
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
  CATEGORY_KEYS.forEach(key => {
    response[key] = doc.valuesByKey.get(key) || [];
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

router.post('/', async (req, res) => {
  const { key, value } = req.body || {};

  if (!key || !value) {
    return res.status(400).json({ message: 'Falta clave o valor' });
  }

  if (!CATEGORY_KEYS.includes(key)) {
    return res.status(400).json({ message: 'Clave de categoria no valida' });
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return res.status(400).json({ message: 'El valor no puede estar vacio' });
  }

  try {
    const doc = await ensureCategoryDocument();
    const values = doc.valuesByKey.get(key) || [];

    if (!values.includes(trimmedValue)) {
      values.push(trimmedValue);
      doc.valuesByKey.set(key, values);
      await doc.save();
    }

    res.json(mapDocToResponse(doc));
  } catch (error) {
    console.error('Error al agregar categoria:', error);
    res.status(500).json({ message: 'Error al agregar categoria' });
  }
});

router.delete('/', async (req, res) => {
  const { key, value } = req.body || {};

  if (!key || !value) {
    return res.status(400).json({ message: 'Falta clave o valor' });
  }

  if (!CATEGORY_KEYS.includes(key)) {
    return res.status(400).json({ message: 'Clave de categoria no valida' });
  }

  const trimmedValue = value.trim();

  try {
    const doc = await ensureCategoryDocument();
    const values = doc.valuesByKey.get(key) || [];
    const filtered = values.filter(item => item !== trimmedValue);

    if (filtered.length === values.length) {
      return res.status(404).json({ message: 'Valor no encontrado en la categoria' });
    }

    doc.valuesByKey.set(key, filtered);
    await doc.save();

    res.json(mapDocToResponse(doc));
  } catch (error) {
    console.error('Error al eliminar categoria:', error);
    res.status(500).json({ message: 'Error al eliminar categoria' });
  }
});

export default router;
