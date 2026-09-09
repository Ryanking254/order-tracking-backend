import pool from '../config/db.js';

export const createDelivery = async (req, res) => {
  try {
    const { driver_id, order_ids } = req.body;

    if (!driver_id || !order_ids || order_ids.length === 0) {
      return res.status(400).json({ message: 'Driver ID and order IDs required' });
    }

    // Create delivery
    const [deliveryResult] = await pool.query(
      'INSERT INTO deliveries (driver_id, status) VALUES (?, ?)',
      [driver_id, 'pending']
    );

    const deliveryId = deliveryResult.insertId;

    // Assign orders to delivery
    for (const orderId of order_ids) {
      await pool.query(
        'UPDATE orders SET delivery_id = ?, status = ? WHERE id = ?',
        [deliveryId, 'assigned', orderId]
      );
    }

    res.status(201).json({
      message: 'Delivery created',
      delivery: { id: deliveryId, driver_id, status: 'pending' },
    });
  } catch (error) {
    console.error('Create delivery error:', error);
    res.status(500).json({ message: 'Error creating delivery' });
  }
};

export const getDriverDeliveries = async (req, res) => {
  try {
    const driverId = req.user.id;

    const [deliveries] = await pool.query(
      `SELECT d.*, COUNT(o.id) as order_count FROM deliveries d 
       LEFT JOIN orders o ON d.id = o.delivery_id 
       WHERE d.driver_id = ? 
       GROUP BY d.id 
       ORDER BY d.created_at DESC`,
      [driverId]
    );

    res.json({ deliveries });
  } catch (error) {
    console.error('Get deliveries error:', error);
    res.status(500).json({ message: 'Error fetching deliveries' });
  }
};

export const getDeliveryOrders = async (req, res) => {
  try {
    const { deliveryId } = req.params;

    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE delivery_id = ? ORDER BY created_at ASC',
      [deliveryId]
    );

    res.json({ orders });
  } catch (error) {
    console.error('Get delivery orders error:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
};

export const startDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;

    await pool.query(
      'UPDATE deliveries SET status = ?, started_at = NOW() WHERE id = ?',
      ['in_progress', deliveryId]
    );

    res.json({ message: 'Delivery started' });
  } catch (error) {
    console.error('Start delivery error:', error);
    res.status(500).json({ message: 'Error starting delivery' });
  }
};

export const completeDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;

    await pool.query(
      'UPDATE deliveries SET status = ?, completed_at = NOW() WHERE id = ?',
      ['completed', deliveryId]
    );

    // Mark all orders as delivered
    await pool.query(
      'UPDATE orders SET status = ? WHERE delivery_id = ?',
      ['delivered', deliveryId]
    );

    res.json({ message: 'Delivery completed' });
  } catch (error) {
    console.error('Complete delivery error:', error);
    res.status(500).json({ message: 'Error completing delivery' });
  }
};

export const getActiveDeliveries = async (req, res) => {
  try {
    const [deliveries] = await pool.query(
      `SELECT d.*, u.name as driver_name FROM deliveries d 
       JOIN users u ON d.driver_id = u.id 
       WHERE d.status = 'in_progress' 
       ORDER BY d.started_at DESC`
    );

    res.json({ deliveries });
  } catch (error) {
    console.error('Get active deliveries error:', error);
    res.status(500).json({ message: 'Error fetching active deliveries' });
  }
};

// GET /api/deliveries/shop-queue — pending, unassigned orders from the driver's shop
export const getShopQueue = async (req, res) => {
  try {
    const [me] = await pool.query('SELECT shop_id FROM users WHERE id = ?', [req.user.id]);
    const shopId = me[0]?.shop_id;
    if (!shopId) {
      return res.status(400).json({ message: 'Join a shop first with your invite code' });
    }
    const [orders] = await pool.query(
      `SELECT o.*, u.name as customer_name, u.phone as customer_phone, s.name as shop_name
       FROM orders o
       JOIN users u ON o.customer_id = u.id
       LEFT JOIN shops s ON o.shop_id = s.id
       WHERE o.shop_id = ? AND o.status = 'pending' AND o.delivery_id IS NULL
       ORDER BY o.created_at ASC`,
      [shopId]
    );
    res.json({ orders });
  } catch (error) {
    console.error('Get shop queue error:', error);
    res.status(500).json({ message: 'Error fetching shop queue' });
  }
};

// POST /api/deliveries/claim — driver takes an order from their shop's queue
export const claimOrder = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { order_id } = req.body;
    if (!order_id) {
      return res.status(400).json({ message: 'order_id required' });
    }

    const [me] = await pool.query('SELECT shop_id FROM users WHERE id = ?', [driverId]);
    const shopId = me[0]?.shop_id;
    if (!shopId) {
      return res.status(400).json({ message: 'Join a shop first with your invite code' });
    }

    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const order = orders[0];
    if (order.status !== 'pending' || order.delivery_id) {
      return res.status(409).json({ message: 'Order already taken' });
    }
    if (order.shop_id !== shopId) {
      return res.status(403).json({ message: 'Order belongs to another shop' });
    }

    const [deliveryResult] = await pool.query(
      'INSERT INTO deliveries (driver_id, status, started_at) VALUES (?, ?, NOW())',
      [driverId, 'in_progress']
    );
    const deliveryId = deliveryResult.insertId;
    await pool.query('UPDATE orders SET delivery_id = ?, status = ? WHERE id = ?', [deliveryId, 'assigned', order_id]);

    res.status(201).json({
      message: 'Order claimed',
      delivery: { id: deliveryId, driver_id: driverId, status: 'in_progress' },
      order: { id: order_id, status: 'assigned', delivery_id: deliveryId },
    });
  } catch (error) {
    console.error('Claim order error:', error);
    res.status(500).json({ message: 'Error claiming order' });
  }
};
