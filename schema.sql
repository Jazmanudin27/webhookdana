-- ====================================================================
-- Database Schema untuk Sistem Depot Air DANA Webhook & ESP32 IoT
-- Jalankan di MySQL server / phpMyAdmin / DBeaver / terminal MySQL:
-- ====================================================================

-- 1. Buat Database jika belum ada
CREATE DATABASE IF NOT EXISTS depot_dana CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE depot_dana;

-- 2. Tabel Multi-Cabang Armada Mesin Depot Air
CREATE TABLE IF NOT EXISTS depot_machines (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255) DEFAULT '',
    status VARCHAR(50) DEFAULT 'OFFLINE',
    total_liters DECIMAL(10,2) DEFAULT 0,
    total_revenue INT DEFAULT 0,
    filter_limit_liters INT DEFAULT 10000,
    filter_used_liters DECIMAL(10,2) DEFAULT 0,
    last_seen DATETIME NULL,
    ip VARCHAR(50) DEFAULT '',
    ssid VARCHAR(100) DEFAULT '',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO depot_machines (id, name, location, status, filter_limit_liters) VALUES
('DEPOT-001', 'Depot Pusat (Prototipe)', 'Kantor Pusat / Workshop', 'ONLINE', 10000);

-- 3. Tabel Pengguna Sistem & Hak Akses (Multi-Tenant RBAC)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'CLIENT', -- 'ADMIN' (Super Admin) atau 'CLIENT' (Mitra Cabang)
    assigned_machine_id VARCHAR(50) DEFAULT NULL,
    phone VARCHAR(50) DEFAULT '',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_assigned_machine (assigned_machine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed User Default Awal (Password default: admin123 untuk admin, 123456 untuk mitra1)
INSERT IGNORE INTO users (id, username, password, name, role, assigned_machine_id, phone, is_active) VALUES
(1, 'admin', 'admin123', 'Administrator Pusat', 'ADMIN', NULL, '08123456789', 1),
(2, 'mitra1', '123456', 'Mitra Cabang 1', 'CLIENT', 'DEPOT-001', '08987654321', 1);

-- 4. Tabel Paket Pengisian Air (Harga & Literan)
CREATE TABLE IF NOT EXISTS packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    liters DECIMAL(6,2) NOT NULL,
    price INT NOT NULL,
    badge VARCHAR(50) DEFAULT '',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert Paket Awal Default
INSERT IGNORE INTO packages (id, name, liters, price, badge, is_active) VALUES
(1, '1 Galon (19L)', 19.00, 7000, 'Populer', 1),
(2, '2 Galon (38L)', 38.00, 14000, 'Hemat', 1),
(3, 'Galon Mini (10L)', 10.00, 4000, 'Praktis', 1);

-- 5. Tabel Transaksi Pembayaran & Pengisian
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(50) DEFAULT 'DEPOT-001',
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
    completed_at DATETIME NULL,
    INDEX idx_device (device_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Tabel Pengaturan Sistem & Konfigurasi WiFi ESP32
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
('wifi_ssid', 'WiFi_Depot_Air'),
('wifi_password', ''),
('pending_wifi_update', '');

-- 7. Tabel Audit Log & Webhook Inspector
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_id VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    payload LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_source (source),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
