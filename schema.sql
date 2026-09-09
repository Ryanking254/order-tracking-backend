-- Create database
CREATE DATABASE IF NOT EXISTS water_tracking;
USE water_tracking;

-- Users table (customers, drivers, admins)
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('customer', 'driver', 'admin') NOT NULL DEFAULT 'customer',
  email VARCHAR(100),
  shop_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- Shops table (one row per onboarded shop/company; admin role = shop owner)
CREATE TABLE shops (
  id INT PRIMARY KEY AUTO_INCREMENT,
  owner_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  image_url LONGTEXT,
  address VARCHAR(255),
  invite_code VARCHAR(12) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Deliveries table (one car, multiple orders per delivery)
CREATE TABLE deliveries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  driver_id INT NOT NULL,
  status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES users(id)
);

-- Orders table
CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customer_id INT NOT NULL,
  shop_id INT,
  delivery_id INT,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  quantity INT NOT NULL,
  status ENUM('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending',
  delivery_address VARCHAR(255) NOT NULL,
  notes TEXT,
  price_per_unit DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
  payment_method ENUM('on_delivery', 'on_app') DEFAULT 'on_delivery',
  payment_status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
);

-- GPS Logs table (driver location tracking)
CREATE TABLE gps_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  delivery_id INT NOT NULL,
  driver_id INT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
  FOREIGN KEY (driver_id) REFERENCES users(id),
  INDEX (delivery_id),
  INDEX (created_at)
);

-- Notifications table
CREATE TABLE notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  order_id INT,
  type VARCHAR(50),
  message TEXT,
  `read` TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Create indexes for faster queries
CREATE INDEX idx_user_role ON users(role);
CREATE INDEX idx_user_shop ON users(shop_id);
CREATE INDEX idx_order_customer ON orders(customer_id);
CREATE INDEX idx_order_status ON orders(status);
CREATE INDEX idx_order_shop ON orders(shop_id);
CREATE INDEX idx_delivery_driver ON deliveries(driver_id);
CREATE INDEX idx_delivery_status ON deliveries(status);
