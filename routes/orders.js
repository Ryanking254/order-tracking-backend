import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import {
  createOrder,
  getCustomerOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
} from '../controllers/orderController.js';

const router = express.Router();

router.post('/', verifyToken, checkRole(['customer']), createOrder);
router.get('/my-orders', verifyToken, checkRole(['customer']), getCustomerOrders);
router.get('/all', verifyToken, checkRole(['admin']), getAllOrders);
router.get('/:orderId', verifyToken, getOrderById);
router.put('/:orderId/status', verifyToken, checkRole(['admin', 'driver']), updateOrderStatus);

export default router;
