import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const signup = async (req, res) => {
  try {
    const { name, phone, password, email, invite_code, shop_id } = req.body;

    // Owner (admin) self-onboarding is allowed: an owner signs up as admin,
    // then creates their shop (name + photo) which generates a driver invite code.
    const allowedRoles = ['customer', 'driver', 'admin'];
    const role = allowedRoles.includes(req.body.role) ? req.body.role : 'customer';

    if (!name || !phone || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user exists
    const [existing] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    // Resolve shop link: drivers join via invite code, customers via shop_id
    let linkedShopId = null;
    if (role === 'driver' && invite_code) {
      const [shops] = await pool.query(
        'SELECT id FROM shops WHERE invite_code = ?',
        [String(invite_code).trim().toUpperCase()]
      );
      if (shops.length === 0) {
        return res.status(400).json({ message: 'Invalid invite code' });
      }
      linkedShopId = shops[0].id;
    } else if (role === 'customer' && shop_id) {
      const [shops] = await pool.query('SELECT id FROM shops WHERE id = ?', [shop_id]);
      if (shops.length === 0) {
        return res.status(400).json({ message: 'Shop not found' });
      }
      linkedShopId = shops[0].id;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [result] = await pool.query(
      'INSERT INTO users (name, phone, password, role, email, shop_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, phone, hashedPassword, role, email || null, linkedShopId]
    );

    const token = jwt.sign(
      { id: result.insertId, phone, role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: result.insertId, name, phone, role, email: email || null, shop_id: linkedShopId },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

export const login = async (req, res) => {  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password required' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    let shop = null;
    if (user.shop_id) {
      const [shops] = await pool.query('SELECT id, name, image_url FROM shops WHERE id = ?', [user.shop_id]);
      shop = shops[0] || null;
    }

    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role, email: user.email, shop_id: user.shop_id },
      shop,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
};

export const me = async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, phone, role, email, shop_id FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = users[0];
    let shop = null;
    if (user.shop_id) {
      const [shops] = await pool.query('SELECT id, name, image_url, address, invite_code FROM shops WHERE id = ?', [user.shop_id]);
      shop = shops[0] || null;
      // Never leak another shop's invite code to customers/drivers via /me;
      // owners see it via /api/shops/my-shop.
      if (shop && user.role !== 'admin') delete shop.invite_code;
    }
    res.json({ user, shop });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ message: 'Error fetching user' });
  }
};
