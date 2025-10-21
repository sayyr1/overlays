import express from 'express';
import {
  addItemToCart,
  clearCart,
  getCart,
  mergeCart,
  removeCartItem,
  updateCartItem
} from '../controllers/cartController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getCart);
router.post('/add', addItemToCart);
router.patch('/item/:productId', updateCartItem);
router.delete('/item/:productId', removeCartItem);
router.delete('/', clearCart);
router.post('/merge', mergeCart);

export default router;
