import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import {
  createDelivery,
  getDriverDeliveries,
  getDeliveryOrders,
  startDelivery,
  completeDelivery,
  getActiveDeliveries,
  getShopQueue,
  claimOrder,
} from '../controllers/driverController.js';

const router = express.Router();

router.post('/', verifyToken, checkRole(['admin']), createDelivery);
router.get('/my-deliveries', verifyToken, checkRole(['driver']), getDriverDeliveries);
router.get('/shop-queue', verifyToken, checkRole(['driver']), getShopQueue);
router.post('/claim', verifyToken, checkRole(['driver']), claimOrder);
router.get('/active', verifyToken, checkRole(['admin']), getActiveDeliveries);
router.get('/:deliveryId/orders', verifyToken, getDeliveryOrders);
router.put('/:deliveryId/start', verifyToken, checkRole(['driver']), startDelivery);
router.put('/:deliveryId/complete', verifyToken, checkRole(['driver']), completeDelivery);

export default router;
