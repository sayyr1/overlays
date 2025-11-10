import express from 'express';
import { protect, adminOnly, optionalProtect } from '../middleware/authMiddleware.js';
import {
  createOrder,
  getOrders,
  getOwnOrders,
  confirmOrder,
  cancelOrder,
  updateOrderStatus,
  clearOrderHistory
} from '../controllers/orderController.js';

const router = express.Router();

router.post('/', optionalProtect, createOrder);
router.get('/', protect, adminOnly, getOrders);
router.get('/mine', protect, getOwnOrders);
router.post('/:id/confirm', protect, adminOnly, confirmOrder);
router.post('/:id/cancel', protect, adminOnly, cancelOrder);
router.patch('/:id/status', protect, adminOnly, updateOrderStatus);
router.delete('/', protect, adminOnly, clearOrderHistory);

export default router;
