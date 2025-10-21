import express from 'express';
import Brand from '../models/Brand.js';
const router = express.Router();

// Obtener todas las marcas
router.get('/', async (req, res) => {
  try {
    const brands = await Brand.find();
    res.json(brands);
  } catch (err) {
    console.error('❌ Error al obtener marcas:', err);
    res.status(500).json({ message: 'Error interno al cargar marcas' });
  }
});

// Crear una nueva marca
router.post('/', async (req, res) => {
  try {
    console.log('Body recibido:', req.body); // Para depurar

    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }

    const exists = await Brand.findOne({ name: name.trim() });
    if (exists) {
      return res.status(400).json({ message: 'Marca ya existe' });
    }

    const brand = new Brand({ name: name.trim() });
    await brand.save();
    res.status(201).json(brand);

  } catch (err) {
    console.error('❌ Error al crear marca:', err);
    res.status(500).json({ message: 'Error interno al crear marca' });
  }
});

// Eliminar marca
router.delete('/:id', async (req, res) => {
  try {
    await Brand.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error('❌ Error al eliminar marca:', err);
    res.status(500).json({ message: 'Error al eliminar marca' });
  }
});

export default router;
