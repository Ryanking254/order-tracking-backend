import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import {
  updateDriverLocation,
  getDeliveryLocationHistory,
  getLatestDriverLocation,
  updateOrderStatus,
} from '../controllers/trackingController.js';

const router = express.Router();

router.post('/location', verifyToken, checkRole(['driver']), updateDriverLocation);
router.get('/:deliveryId/history', verifyToken, getDeliveryLocationHistory);
router.get('/:deliveryId/latest', verifyToken, getLatestDriverLocation);
router.put('/order/:orderId/status', verifyToken, checkRole(['driver']), updateOrderStatus);

export default router;
