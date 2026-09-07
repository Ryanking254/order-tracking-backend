import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import {
  processPayment,
  getOrderPaymentStatus,
  confirmPaymentOnDelivery,
} from '../controllers/paymentController.js';

const router = express.Router();

// Customer pays for order in app
router.post('/process', verifyToken, checkRole(['customer']), processPayment);

// Get payment status
router.get('/:orderId', verifyToken, getOrderPaymentStatus);

// Driver confirms payment received on delivery
router.put('/:orderId/confirm-on-delivery', verifyToken, checkRole(['driver']), confirmPaymentOnDelivery);

export default router;
