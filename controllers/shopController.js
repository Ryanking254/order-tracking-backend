import pool from '../config/db.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

async function generateInviteCode() {
  for (let i = 0; i < 10; i++) {
    let code = '';
    for (let j = 0; j < 6; j++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    const [rows] = await pool.query('SELECT id FROM shops WHERE invite_code = ?', [code]);
    if (rows.length === 0) return code;
  }
  throw new Error('Could not generate invite code');
}

// GET /api/shops — any signed-in user; public directory (no invite codes)
export const listShops = async (req, res) => {
  try {
    const [shops] = await pool.query(
      `SELECT s.id, s.name, s.image_url, s.address, s.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.shop_id = s.id AND u.role = 'driver') AS driver_count,
              (SELECT COUNT(*) FROM orders o WHERE o.shop_id = s.id AND o.status NOT IN ('delivered','cancelled')) AS active_orders
       FROM shops s ORDER BY s.created_at DESC`
    );
    res.json({ shops });
  } catch (error) {
    console.error('List shops error:', error);
    res.status(500).json({ message: 'Error fetching shops' });
  }
};

// POST /api/shops — admin (shop owner) creates their shop
export const createShop = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { name, image_url, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Shop name required' });
    }

    const [existing] = await pool.query('SELECT id FROM shops WHERE owner_id = ?', [ownerId]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'You already have a shop', shop_id: existing[0].id });
    }

    const invite_code = await generateInviteCode();
    const [result] = await pool.query(
      'INSERT INTO shops (owner_id, name, image_url, address, invite_code) VALUES (?, ?, ?, ?, ?)',
      [ownerId, name.trim(), image_url || null, address || null, invite_code]
    );

    // Owner belongs to their own shop
    await pool.query('UPDATE users SET shop_id = ? WHERE id = ?', [result.insertId, ownerId]);

    const [shops] = await pool.query('SELECT * FROM shops WHERE id = ?', [result.insertId]);
    res.status(201).json({ message: 'Shop created', shop: shops[0] });
  } catch (error) {
    console.error('Create shop error:', error);
    res.status(500).json({ message: 'Error creating shop' });
  }
};

// GET /api/shops/my-shop — admin's own shop + drivers
export const getMyShop = async (req, res) => {
  try {
    const [shops] = await pool.query('SELECT * FROM shops WHERE owner_id = ?', [req.user.id]);
    if (shops.length === 0) {
      return res.status(404).json({ message: 'No shop yet' });
    }
    const shop = shops[0];
    const [drivers] = await pool.query(
      `SELECT id, name, phone, email, created_at FROM users
       WHERE shop_id = ? AND role = 'driver' ORDER BY name`,
      [shop.id]
    );
    res.json({ shop, drivers });
  } catch (error) {
    console.error('Get my shop error:', error);
    res.status(500).json({ message: 'Error fetching shop' });
  }
};

// POST /api/shops/regenerate-code — admin rotates the driver invite code
export const regenerateCode = async (req, res) => {
  try {
    const [shops] = await pool.query('SELECT id FROM shops WHERE owner_id = ?', [req.user.id]);
    if (shops.length === 0) {
      return res.status(404).json({ message: 'No shop yet' });
    }
    const invite_code = await generateInviteCode();
    await pool.query('UPDATE shops SET invite_code = ? WHERE id = ?', [invite_code, shops[0].id]);
    res.json({ message: 'Invite code regenerated', invite_code });
  } catch (error) {
    console.error('Regenerate code error:', error);
    res.status(500).json({ message: 'Error regenerating code' });
  }
};

// POST /api/shops/join — driver links to a shop via invite code
export const joinWithCode = async (req, res) => {
  try {
    const { invite_code } = req.body;
    if (!invite_code) {
      return res.status(400).json({ message: 'Invite code required' });
    }
    const code = String(invite_code).trim().toUpperCase();
    const [shops] = await pool.query('SELECT * FROM shops WHERE invite_code = ?', [code]);
    if (shops.length === 0) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }
    await pool.query('UPDATE users SET shop_id = ? WHERE id = ?', [shops[0].id, req.user.id]);
    res.json({
      message: `Joined ${shops[0].name}`,
      shop: { id: shops[0].id, name: shops[0].name, image_url: shops[0].image_url },
    });
  } catch (error) {
    console.error('Join shop error:', error);
    res.status(500).json({ message: 'Error joining shop' });
  }
};

// POST /api/shops/choose — customer picks their preferred shop
export const chooseShop = async (req, res) => {
  try {
    const { shop_id } = req.body;
    if (!shop_id) {
      return res.status(400).json({ message: 'shop_id required' });
    }
    const [shops] = await pool.query('SELECT id, name, image_url FROM shops WHERE id = ?', [shop_id]);
    if (shops.length === 0) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    await pool.query('UPDATE users SET shop_id = ? WHERE id = ?', [shop_id, req.user.id]);
    res.json({ message: `Shop set to ${shops[0].name}`, shop: shops[0] });
  } catch (error) {
    console.error('Choose shop error:', error);
    res.status(500).json({ message: 'Error choosing shop' });
  }
};
