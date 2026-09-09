// Idempotent migration: shops + users.shop_id + orders.shop_id
// Run: node migrate-shops.js
import pool from './config/db.js';

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].n > 0;
}

async function tableExists(table) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows[0].n > 0;
}

async function main() {
  console.log('DB:', (await pool.query('SELECT DATABASE() AS db'))[0]);

  if (!(await tableExists('shops'))) {
    await pool.query(`
      CREATE TABLE shops (
        id INT PRIMARY KEY AUTO_INCREMENT,
        owner_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        image_url LONGTEXT,
        address VARCHAR(255),
        invite_code VARCHAR(12) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id),
        INDEX idx_shop_owner (owner_id),
        INDEX idx_shop_invite (invite_code)
      )
    `);
    console.log('created shops');
  } else {
    console.log('shops exists');
  }

  if (!(await columnExists('users', 'shop_id'))) {
    await pool.query(`ALTER TABLE users ADD COLUMN shop_id INT NULL`);
    console.log('added users.shop_id');
  } else {
    console.log('users.shop_id exists');
  }

  if (!(await columnExists('orders', 'shop_id'))) {
    await pool.query(`ALTER TABLE orders ADD COLUMN shop_id INT NULL`);
    console.log('added orders.shop_id');
  } else {
    console.log('orders.shop_id exists');
  }

  // Helpful indexes (ignore if they already exist)
  for (const [label, sql] of [
    ['idx_user_shop', `CREATE INDEX idx_user_shop ON users(shop_id)`],
    ['idx_order_shop', `CREATE INDEX idx_order_shop ON orders(shop_id)`],
  ]) {
    try {
      await pool.query(sql);
      console.log('created', label);
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') console.log(label, 'exists');
      else throw e;
    }
  }

  console.log('MIGRATION_OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('MIGRATION_FAIL', e.code || e.message);
  process.exit(1);
});
