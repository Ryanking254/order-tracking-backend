import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import driverRoutes from './routes/drivers.js';
import trackingRoutes from './routes/tracking.js';
import paymentRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';

// Import middleware
import { verifyToken } from './middleware/auth.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'https://yourdomain.com'],
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/deliveries', driverRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Root route (avoids 404 when opening the backend URL in a browser)
app.get('/', (req, res) => {
  res.json({
    status: 'Server is running',
    health: '/api/health',
    db: '/api/health/db',
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// DB connectivity probe (no internals leaked)
app.get('/api/health/db', async (req, res) => {
  try {
    const pool = (await import('./config/db.js')).default;
    await pool.query('SELECT 1');
    res.json({ status: 'Server is running', database: 'connected' });
  } catch (err) {
    console.error('DB health check failed:', err.code || err.message);
    res.status(503).json({ status: 'Server is running', database: 'unreachable' });
  }
});

// Socket.io Events for Real-Time Tracking
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Customer joins a room to watch order status
  socket.on('join-order-room', (orderId) => {
    socket.join(`order-${orderId}`);
    console.log(`Socket ${socket.id} joined room: order-${orderId}`);
  });

  // Driver joins a room for their delivery
  socket.on('join-delivery-room', (deliveryId) => {
    socket.join(`delivery-${deliveryId}`);
    console.log(`Socket ${socket.id} joined room: delivery-${deliveryId}`);
  });

  // Admin joins a room to watch all deliveries
  socket.on('join-admin-room', () => {
    socket.join('admin-room');
    console.log(`Socket ${socket.id} joined admin room`);
  });

  // Driver sends live location update
  socket.on('driver-location-update', (data) => {
    const { delivery_id, latitude, longitude, accuracy } = data;
    
    // Broadcast to customers watching this delivery
    io.to(`delivery-${delivery_id}`).emit('location-update', {
      latitude,
      longitude,
      accuracy,
      timestamp: new Date(),
    });

    // Broadcast to admin dashboard
    io.to('admin-room').emit('driver-location-update', {
      delivery_id,
      latitude,
      longitude,
      accuracy,
      timestamp: new Date(),
    });

    console.log(`Location update for delivery ${delivery_id}`);
  });

  // Order status change
  socket.on('order-status-changed', (data) => {
    const { order_id, status, delivery_id } = data;
    
    // Notify customer
    io.to(`order-${order_id}`).emit('status-update', {
      order_id,
      status,
      timestamp: new Date(),
    });

    // Notify admin
    io.to('admin-room').emit('order-status-update', {
      order_id,
      status,
      timestamp: new Date(),
    });

    console.log(`Order ${order_id} status changed to ${status}`);
  });

  // Delivery status change
  socket.on('delivery-status-changed', (data) => {
    const { delivery_id, status } = data;
    
    io.to(`delivery-${delivery_id}`).emit('delivery-status-update', {
      delivery_id,
      status,
      timestamp: new Date(),
    });

    io.to('admin-room').emit('delivery-status-update', {
      delivery_id,
      status,
      timestamp: new Date(),
    });

    console.log(`Delivery ${delivery_id} status changed to ${status}`);
  });

  // Leave room
  socket.on('leave-room', (room) => {
    socket.leave(room);
    console.log(`Socket ${socket.id} left room: ${room}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Socket.io listening on port ${PORT}`);
});
