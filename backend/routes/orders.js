import express from 'express';
import {
  protect,
  adminOnly,
  optionalProtect,
  requirePermission
} from '../middleware/authMiddleware.js';
import { requireModuleEnabled } from '../middleware/moduleMiddleware.js';
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

router.post('/', optionalProtect, requireModuleEnabled(['orders', 'payments']), createOrder);
router.get('/', protect, adminOnly, requireModuleEnabled('orders'), requirePermission('orders', 'view'), getOrders);
router.get('/mine', protect, requireModuleEnabled('orders'), getOwnOrders);
router.post('/:id/confirm', protect, adminOnly, requireModuleEnabled('orders'), requirePermission('orders', 'confirm'), confirmOrder);
router.post('/:id/cancel', protect, adminOnly, requireModuleEnabled('orders'), requirePermission('orders', 'cancel'), cancelOrder);
router.patch('/:id/status', protect, adminOnly, requireModuleEnabled('orders'), requirePermission('orders', 'update'), updateOrderStatus);
router.delete('/', protect, adminOnly, requireModuleEnabled('orders'), requirePermission('orders', 'deleteHistory'), clearOrderHistory);

export default router;
