import pool from '../config/db.js';

export const updateDriverLocation = async (req, res) => {
  try {
    const { delivery_id, latitude, longitude, accuracy } = req.body;
    const driverId = req.user.id;

    if (!delivery_id || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Missing location data' });
    }

    // Save GPS log
    const [result] = await pool.query(
      'INSERT INTO gps_logs (delivery_id, driver_id, latitude, longitude, accuracy) VALUES (?, ?, ?, ?, ?)',
      [delivery_id, driverId, latitude, longitude, accuracy || null]
    );

    res.json({
      message: 'Location updated',
      gps_log_id: result.insertId,
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Error updating location' });
  }
};

export const getDeliveryLocationHistory = async (req, res) => {
  try {
    const { deliveryId } = req.params;

    const [logs] = await pool.query(
      'SELECT latitude, longitude, accuracy, created_at FROM gps_logs WHERE delivery_id = ? ORDER BY created_at ASC',
      [deliveryId]
    );

    res.json({ logs });
  } catch (error) {
    console.error('Get location history error:', error);
    res.status(500).json({ message: 'Error fetching location history' });
  }
};

export const getLatestDriverLocation = async (req, res) => {
  try {
    const { deliveryId } = req.params;

    const [logs] = await pool.query(
      'SELECT latitude, longitude, accuracy, created_at FROM gps_logs WHERE delivery_id = ? ORDER BY created_at DESC LIMIT 1',
      [deliveryId]
    );

    if (logs.length === 0) {
      return res.status(404).json({ message: 'No location data found' });
    }

    res.json({ location: logs[0] });
  } catch (error) {
    console.error('Get latest location error:', error);
    res.status(500).json({ message: 'Error fetching location' });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status required' });
    }

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

    res.json({ message: 'Order status updated' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Error updating order status' });
  }
};
