import express from 'express';
import Brand from '../models/Brand.js';
import { protect, adminOnly, requirePermission } from '../middleware/authMiddleware.js';
import { requireModuleEnabled } from '../middleware/moduleMiddleware.js';

const router = express.Router();

router.use(requireModuleEnabled('brands'));

router.get('/', async (req, res) => {
  try {
    const brands = await Brand.find();
    res.json(brands);
  } catch (err) {
    console.error('Error al obtener marcas:', err);
    res.status(500).json({ message: 'Error interno al cargar marcas' });
  }
});

router.post('/', protect, adminOnly, requirePermission('brands', 'manage'), async (req, res) => {
  try {
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
    console.error('Error al crear marca:', err);
    res.status(500).json({ message: 'Error interno al crear marca' });
  }
});

router.delete('/:id', protect, adminOnly, requirePermission('brands', 'manage'), async (req, res) => {
  try {
    await Brand.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error('Error al eliminar marca:', err);
    res.status(500).json({ message: 'Error al eliminar marca' });
  }
});

export default router;
