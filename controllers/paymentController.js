import pool from '../config/db.js';
import { sendPaymentConfirmationEmail } from '../services/emailService.js';

export const processPayment = async (req, res) => {
  try {
    const { orderId, payment_method, transaction_id } = req.body;
    const customerId = req.user.id;

    if (!orderId || !payment_method) {
      return res.status(400).json({ message: 'Order ID and payment method required' });
    }

    // Get order
    const [orders] = await pool.query(
      'SELECT o.*, u.email, u.name FROM orders o JOIN users u ON o.customer_id = u.id WHERE o.id = ? AND o.customer_id = ?',
      [orderId, customerId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orders[0];

    // Update payment status
    await pool.query(
      'UPDATE orders SET payment_status = ?, payment_method = ? WHERE id = ?',
      ['completed', payment_method, orderId]
    );

    // Send payment confirmation email
    if (order.email) {
      await sendPaymentConfirmationEmail(order.email, {
        order_number: order.order_number,
        customer_name: order.name,
        total_price: order.total_price,
        payment_method,
        transaction_id: transaction_id || 'N/A',
      });
    }

    res.json({
      message: 'Payment processed successfully',
      payment: {
        orderId,
        payment_status: 'completed',
        payment_method,
        amount: order.total_price,
        transaction_id: transaction_id || null,
      },
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ message: 'Error processing payment' });
  }
};

export const getOrderPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const [orders] = await pool.query(
      'SELECT id, order_number, payment_status, payment_method, total_price FROM orders WHERE id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ payment: orders[0] });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ message: 'Error fetching payment status' });
  }
};

export const confirmPaymentOnDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const driverId = req.user.id;

    // Get order
    const [orders] = await pool.query(
      'SELECT o.*, u.email, u.name FROM orders o JOIN users u ON o.customer_id = u.id WHERE o.id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orders[0];

    // Only allow if payment method is "on_delivery"
    if (order.payment_method !== 'on_delivery') {
      return res.status(400).json({ message: 'Order not set for on-delivery payment' });
    }

    // Update payment status
    await pool.query(
      'UPDATE orders SET payment_status = ? WHERE id = ?',
      ['completed', orderId]
    );

    // Send confirmation email
    if (order.email) {
      await sendPaymentConfirmationEmail(order.email, {
        order_number: order.order_number,
        customer_name: order.name,
        total_price: order.total_price,
        payment_method: 'on_delivery',
      });
    }

    res.json({
      message: 'Payment confirmed on delivery',
      payment: {
        orderId,
        payment_status: 'completed',
        payment_method: 'on_delivery',
        amount: order.total_price,
      },
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ message: 'Error confirming payment' });
  }
};
