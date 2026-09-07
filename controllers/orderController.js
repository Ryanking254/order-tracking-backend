import pool from '../config/db.js';
import { sendOrderStatusEmail, sendPaymentConfirmationEmail } from '../services/emailService.js';

export const createOrder = async (req, res) => {
  try {
    const { quantity, delivery_address, notes, price_per_unit, payment_method } = req.body;
    const customerId = req.user.id;

    if (!quantity || !delivery_address || !price_per_unit) {
      return res.status(400).json({ message: 'Quantity, address, and price required' });
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}`;
    const totalPrice = quantity * price_per_unit;

    // Get customer info
    const [users] = await pool.query('SELECT name, email FROM users WHERE id = ?', [customerId]);
    const customerEmail = users[0]?.email;
    const customerName = users[0]?.name || 'Valued Customer';

    const [result] = await pool.query(
      'INSERT INTO orders (customer_id, order_number, quantity, delivery_address, notes, price_per_unit, total_price, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [customerId, orderNumber, quantity, delivery_address, notes || '', price_per_unit, totalPrice, payment_method || 'on_delivery', 'pending']
    );

    // Send confirmation email if email exists
    if (customerEmail) {
      await sendOrderStatusEmail(customerEmail, {
        order_number: orderNumber,
        customer_name: customerName,
        quantity,
        delivery_address,
        status: 'pending',
        total_price: totalPrice,
      });
    }

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: result.insertId,
        order_number: orderNumber,
        status: 'pending',
        quantity,
        delivery_address,
        total_price: totalPrice,
        payment_method: payment_method || 'on_delivery',
        payment_status: 'pending',
      },
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Error creating order' });
  }
};

export const getCustomerOrders = async (req, res) => {
  try {
    const customerId = req.user.id;

    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC',
      [customerId]
    );

    res.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const [orders] = await pool.query(
      'SELECT o.*, d.driver_id, u.name as driver_name FROM orders o LEFT JOIN deliveries d ON o.delivery_id = d.id LEFT JOIN users u ON d.driver_id = u.id WHERE o.id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ order: orders[0] });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Error fetching order' });
  }
};

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

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status required' });
    }

    // Get order and customer info
    const [orders] = await pool.query(
      'SELECT o.*, u.email, u.name FROM orders o JOIN users u ON o.customer_id = u.id WHERE o.id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orders[0];
    
    // Update status
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

    // Send email notification if customer has email
    if (order.email) {
      await sendOrderStatusEmail(order.email, {
        order_number: order.order_number,
        customer_name: order.name,
        quantity: order.quantity,
        delivery_address: order.delivery_address,
        status,
        total_price: order.total_price,
      });
    }

    res.json({ message: 'Order status updated' });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ message: 'Error updating order' });
  }
};
