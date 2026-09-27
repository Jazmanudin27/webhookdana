-- Database Schema untuk Sistem Depot Air DANA Webhook & ESP32
-- Buat database jika belum ada:
-- CREATE DATABASE IF NOT EXISTS depot_dana CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE depot_dana;

-- 1. Tabel Paket Pengisian Air (Harga & Literan)
CREATE TABLE IF NOT EXISTS packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    liters DECIMAL(6,2) NOT NULL,
    price INT NOT NULL,
    badge VARCHAR(50) DEFAULT '',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert Paket Awal Default
INSERT IGNORE INTO packages (id, name, liters, price, badge, is_active) VALUES
(1, '1 Galon (19L)', 19.00, 7000, 'Populer', 1),
(2, '2 Galon (38L)', 38.00, 14000, 'Hemat', 1),
(3, 'Galon Mini (10L)', 10.00, 4000, 'Praktis', 1);

-- 2. Tabel Transaksi Pembayaran & Pengisian
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL UNIQUE,
    merchant_trans_id VARCHAR(100),
    customer_name VARCHAR(100) DEFAULT 'Pelanggan Depot',
    title VARCHAR(150) NOT NULL,
    target_liter DECIMAL(6,2) NOT NULL,
    dispensed_liter DECIMAL(6,2) DEFAULT 0,
    amount INT NOT NULL,
    currency VARCHAR(10) DEFAULT 'IDR',
    status VARCHAR(50) DEFAULT 'PENDING',
    acquirement_id VARCHAR(150),
    duration_seconds INT DEFAULT 0,
    qr_string TEXT,
    checkout_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME NULL,
    completed_at DATETIME NULL
);

-- 3. Tabel Pengaturan Sistem & Konfigurasi WiFi ESP32
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
('wifi_ssid', 'WiFi_Depot_Air'),
('wifi_password', ''),
('pending_wifi_update', '');

-- 4. Tabel Audit Log & Webhook Inspector
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_id VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    payload LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
