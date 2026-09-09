import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import {
  listShops,
  createShop,
  getMyShops,
  regenerateCode,
  joinWithCode,
  chooseShop,
} from '../controllers/shopController.js';

const router = express.Router();

router.get('/', verifyToken, listShops);
router.post('/', verifyToken, checkRole(['admin']), createShop);
router.get('/my-shops', verifyToken, checkRole(['admin']), getMyShops);
router.post('/regenerate-code', verifyToken, checkRole(['admin']), regenerateCode);
router.post('/join', verifyToken, checkRole(['driver', 'admin']), joinWithCode);
router.post('/choose', verifyToken, checkRole(['customer']), chooseShop);

export default router;
