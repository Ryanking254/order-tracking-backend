import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import {
  getAllOrders,
  getActiveDeliveries,
  createDelivery,
  getDashboardStats,
  getDrivers,
} from '../controllers/adminController.js';

const router = express.Router();

// All routes require admin role
router.use(verifyToken, checkRole(['admin']));

// Get all orders
router.get('/orders', getAllOrders);

// Get active deliveries with map data
router.get('/deliveries/active', getActiveDeliveries);

// Create new delivery assignment
router.post('/deliveries', createDelivery);

// Get dashboard statistics
router.get('/dashboard/stats', getDashboardStats);

// Get all drivers (for delivery assignment)
router.get('/drivers', getDrivers);

export default router;
