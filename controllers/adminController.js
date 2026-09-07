import pool from '../config/db.js';

export const getAllOrders = async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.*, u.name as customer_name, u.phone as customer_phone, 
              d.driver_id, du.name as driver_name, du.phone as driver_phone
       FROM orders o 
       JOIN users u ON o.customer_id = u.id 
       LEFT JOIN deliveries d ON o.delivery_id = d.id 
       LEFT JOIN users du ON d.driver_id = du.id 
       ORDER BY o.created_at DESC`
    );

    res.json({ orders });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
};

export const getActiveDeliveries = async (req, res) => {
  try {
    const [deliveries] = await pool.query(
      `SELECT d.*, u.name as driver_name, u.phone as driver_phone,
              COUNT(o.id) as order_count, SUM(o.quantity) as total_quantity
       FROM deliveries d 
       JOIN users u ON d.driver_id = u.id 
       LEFT JOIN orders o ON d.id = o.delivery_id
       WHERE d.status = 'in_progress'
       GROUP BY d.id
       ORDER BY d.started_at DESC`
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

export const getDashboardStats = async (req, res) => {
  try {
    // Total orders today
    const [todayOrders] = await pool.query(
      "SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURDATE()"
    );

    // Pending orders
    const [pendingOrders] = await pool.query(
      "SELECT COUNT(*) as count FROM orders WHERE status = 'pending'"
    );

    // Active deliveries
    const [activeDeliveries] = await pool.query(
      "SELECT COUNT(*) as count FROM deliveries WHERE status = 'in_progress'"
    );

    // Revenue today
    const [todayRevenue] = await pool.query(
      "SELECT SUM(total_price) as total FROM orders WHERE DATE(created_at) = CURDATE() AND payment_status = 'completed'"
    );

    // Total customers
    const [totalCustomers] = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'customer'"
    );

    // Average order value
    const [avgOrderValue] = await pool.query(
      "SELECT AVG(total_price) as average FROM orders"
    );

    // Completed deliveries today
    const [completedDeliveries] = await pool.query(
      "SELECT COUNT(*) as count FROM deliveries WHERE status = 'completed' AND DATE(completed_at) = CURDATE()"
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
