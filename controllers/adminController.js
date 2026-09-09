import pool from '../config/db.js';

// IDs of all shops owned by this admin (owners may own multiple shops).
// Falls back to the user's active shop for legacy accounts.
async function ownerShopIds(ownerId) {
  const [rows] = await pool.query('SELECT id FROM shops WHERE owner_id = ?', [ownerId]);
  if (rows.length > 0) return rows.map((r) => r.id);
  const [me] = await pool.query('SELECT shop_id FROM users WHERE id = ?', [ownerId]);
  return me[0]?.shop_id ? [me[0].shop_id] : [];
}

export const getAllOrders = async (req, res) => {
  try {
    const shopIds = await ownerShopIds(req.user.id);
    if (shopIds.length === 0) return res.json({ orders: [] });
    const [orders] = await pool.query(
      `SELECT o.*, u.name as customer_name, u.phone as customer_phone, 
              d.driver_id, du.name as driver_name, du.phone as driver_phone,
              s.name as shop_name
       FROM orders o 
       JOIN users u ON o.customer_id = u.id 
       LEFT JOIN deliveries d ON o.delivery_id = d.id 
       LEFT JOIN users du ON d.driver_id = du.id 
       LEFT JOIN shops s ON o.shop_id = s.id
       WHERE o.shop_id IN (?)
       ORDER BY o.created_at DESC`,
      [shopIds]
    );

    res.json({ orders });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
};

export const getActiveDeliveries = async (req, res) => {
  try {
    const shopIds = await ownerShopIds(req.user.id);
    if (shopIds.length === 0) return res.json({ deliveries: [] });
    const [deliveries] = await pool.query(
      `SELECT d.*, u.name as driver_name, u.phone as driver_phone,
              COUNT(o.id) as order_count, SUM(o.quantity) as total_quantity
       FROM deliveries d 
       JOIN users u ON d.driver_id = u.id 
       LEFT JOIN orders o ON d.id = o.delivery_id
       WHERE d.status = 'in_progress' AND u.shop_id IN (?)
       GROUP BY d.id
       ORDER BY d.started_at DESC`,
      [shopIds]
    );

    // Get latest GPS location for each active delivery
    for (let delivery of deliveries) {
      const [gpsLogs] = await pool.query(
        'SELECT latitude, longitude, accuracy, created_at FROM gps_logs WHERE delivery_id = ? ORDER BY created_at DESC LIMIT 1',
        [delivery.id]
      );
      delivery.latest_location = gpsLogs[0] || null;
    }

    res.json({ deliveries });
  } catch (error) {
    console.error('Get active deliveries error:', error);
    res.status(500).json({ message: 'Error fetching deliveries' });
  }
};

export const createDelivery = async (req, res) => {
  try {
    const { driver_id, order_ids } = req.body;

    if (!driver_id || !order_ids || order_ids.length === 0) {
      return res.status(400).json({ message: 'Driver ID and order IDs required' });
    }

    // Same-shop guard: driver must belong to one of the owner's shops
    const shopIds = await ownerShopIds(req.user.id);
    if (shopIds.length > 0) {
      const [drivers] = await pool.query('SELECT shop_id FROM users WHERE id = ? AND role = ?', [driver_id, 'driver']);
      if (drivers.length === 0 || !shopIds.includes(drivers[0].shop_id)) {
        return res.status(403).json({ message: 'Driver is not in your shops' });
      }
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
      delivery: { id: deliveryId, driver_id, status: 'pending', order_ids },
    });
  } catch (error) {
    console.error('Create delivery error:', error);
    res.status(500).json({ message: 'Error creating delivery' });
  }
};

export const getDrivers = async (req, res) => {
  try {
    const shopIds = await ownerShopIds(req.user.id);
    if (shopIds.length === 0) return res.json({ drivers: [] });
    const [drivers] = await pool.query(
      `SELECT u.id, u.name, u.phone, u.email, u.created_at, s.name AS shop_name FROM users u
       LEFT JOIN shops s ON u.shop_id = s.id
       WHERE u.role = 'driver' AND u.shop_id IN (?) ORDER BY s.name, u.name`,
      [shopIds]
    );

    res.json({ drivers });
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({ message: 'Error fetching drivers' });
  }
};

export const getDashboardStats = async (req, res) => {  try {
    const shopIds = await ownerShopIds(req.user.id);
    if (shopIds.length === 0) {
      return res.json({
        stats: {
          today_orders: 0,
          pending_orders: 0,
          active_deliveries: 0,
          today_revenue: 0,
          total_customers: 0,
          avg_order_value: 0,
          completed_today: 0,
        },
      });
    }
    // Total orders today
    const [todayOrders] = await pool.query(
      `SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURDATE() AND shop_id IN (?)`,
      [shopIds]
    );

    // Pending orders
    const [pendingOrders] = await pool.query(
      `SELECT COUNT(*) as count FROM orders WHERE status = 'pending' AND shop_id IN (?)`,
      [shopIds]
    );

    // Active deliveries
    const [activeDeliveries] = await pool.query(
      `SELECT COUNT(*) as count FROM deliveries d JOIN users u ON d.driver_id = u.id
       WHERE d.status = 'in_progress' AND u.shop_id IN (?)`,
      [shopIds]
    );

    // Revenue today
    const [todayRevenue] = await pool.query(
      `SELECT SUM(total_price) as total FROM orders WHERE DATE(created_at) = CURDATE() AND payment_status = 'completed' AND shop_id IN (?)`,
      [shopIds]
    );

    // Total customers
    const [totalCustomers] = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'customer'"
    );

    // Average order value
    const [avgOrderValue] = await pool.query(
      `SELECT AVG(total_price) as average FROM orders WHERE shop_id IN (?)`,
      [shopIds]
    );

    // Completed deliveries today
    const [completedDeliveries] = await pool.query(
      `SELECT COUNT(*) as count FROM deliveries d JOIN users u ON d.driver_id = u.id
       WHERE d.status = 'completed' AND DATE(d.completed_at) = CURDATE() AND u.shop_id IN (?)`,
      [shopIds]
    );

    res.json({
      stats: {
        today_orders: todayOrders[0]?.count || 0,
        pending_orders: pendingOrders[0]?.count || 0,
        active_deliveries: activeDeliveries[0]?.count || 0,
        today_revenue: todayRevenue[0]?.total || 0,
        total_customers: totalCustomers[0]?.count || 0,
        avg_order_value: avgOrderValue[0]?.average || 0,
        completed_today: completedDeliveries[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Error fetching stats' });
  }
};
