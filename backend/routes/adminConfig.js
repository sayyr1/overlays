import express from 'express';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { getFormDefinitions } from '../services/systemConfigService.js';

const router = express.Router();

router.use(protect, adminOnly);

router.get('/forms/:key', async (req, res) => {
  const forms = await getFormDefinitions({ scope: 'admin' });
  const form = forms.find(item => item.key === req.params.key);

  if (!form) {
    return res.status(404).json({ message: 'Configuracion admin no encontrada' });
  }

  return res.json(form);
});

export default router;
