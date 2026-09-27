const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const PACKAGES_FILE = path.join(DATA_DIR, 'packages.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Default initial data
const DEFAULT_PACKAGES = [
  { id: 1, name: '1 Galon (19L)', liters: 19, price: 7000, badge: 'Populer', isActive: 1 },
  { id: 2, name: '2 Galon (38L)', liters: 38, price: 14000, badge: 'Hemat', isActive: 1 },
  { id: 3, name: 'Galon Mini (10L)', liters: 10, price: 4000, badge: 'Praktis', isActive: 1 }
];

let pool = null;
let isMySqlConnected = false;

// In-Memory fallbacks
let memPackages = [...DEFAULT_PACKAGES];
let memTransactions = [];
let memLogs = [];
let memSettings = {
  wifi_ssid: 'WiFi_Depot_Air',
  wifi_password: '',
  pending_wifi_update: null
};

// Load JSON fallback files
try {
  if (fs.existsSync(PACKAGES_FILE)) memPackages = JSON.parse(fs.readFileSync(PACKAGES_FILE, 'utf8'));
  if (fs.existsSync(TRANSACTIONS_FILE)) memTransactions = JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8'));
  if (fs.existsSync(LOGS_FILE)) memLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
  if (fs.existsSync(SETTINGS_FILE)) memSettings = { ...memSettings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
} catch (e) {}

async function initDB() {
  const dbHost = process.env.DB_HOST;
  const dbUser = process.env.DB_USER;
  const dbPass = process.env.DB_PASS || process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'depot_dana';
  const dbPort = Number(process.env.DB_PORT) || 3306;

  if (dbHost && dbUser) {
    try {
      console.log(`🔌 Mencoba koneksi ke MySQL Server (${dbHost}:${dbPort}, DB: ${dbName})...`);
      
      // Buat koneksi awal untuk memastikan database ada
      const tempConn = await mysql.createConnection({
        host: dbHost,
        user: dbUser,
        password: dbPass,
        port: dbPort
      });
      await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await tempConn.end();

      // Buat Pool ke database tujuan
      pool = mysql.createPool({
        host: dbHost,
        user: dbUser,
        password: dbPass,
        database: dbName,
        port: dbPort,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      // Buat Tabel Otomatis
      await pool.query(`
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
      `);

      await pool.query(`
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
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          setting_key VARCHAR(50) PRIMARY KEY,
          setting_value TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          log_id VARCHAR(100) NOT NULL,
          source VARCHAR(50) NOT NULL,
          type VARCHAR(50) NOT NULL,
          message TEXT NOT NULL,
          payload LONGTEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed paket awal jika masih kosong
      const [rows] = await pool.query('SELECT COUNT(*) as count FROM packages');
      if (rows[0].count === 0) {
        for (const pkg of DEFAULT_PACKAGES) {
          await pool.query(
            'INSERT INTO packages (name, liters, price, badge, is_active) VALUES (?, ?, ?, ?, ?)',
            [pkg.name, pkg.liters, pkg.price, pkg.badge, pkg.isActive]
          );
        }
      }

      isMySqlConnected = true;
      console.log(`✅ DATABASE MYSQL TERHUBUNG! (Database: ${dbName})`);
    } catch (error) {
      console.error('⚠️ Gagal terhubung ke MySQL:', error.message);
      console.log('🔄 Beralih menggunakan JSON Storage (data/)...');
      isMySqlConnected = false;
    }
  } else {
    console.log('ℹ️ DB_HOST belum diatur di .env -> Menggunakan File JSON Storage');
  }
}

// =====================================
// PACKAGES DAO (HARGA & LITERAN AIR)
// =====================================
async function getPackages() {
  if (isMySqlConnected) {
    const [rows] = await pool.query('SELECT * FROM packages WHERE is_active = 1 ORDER BY liters ASC');
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      liters: Number(r.liters),
      price: Number(r.price),
      badge: r.badge,
      isActive: Boolean(r.is_active)
    }));
  }
  return memPackages.filter(p => p.isActive);
}

async function getAllPackagesAdmin() {
  if (isMySqlConnected) {
    const [rows] = await pool.query('SELECT * FROM packages ORDER BY liters ASC');
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      liters: Number(r.liters),
      price: Number(r.price),
      badge: r.badge,
      isActive: Boolean(r.is_active)
    }));
  }
  return memPackages;
}

async function savePackage(pkg) {
  if (isMySqlConnected) {
    if (pkg.id) {
      await pool.query(
        'UPDATE packages SET name=?, liters=?, price=?, badge=?, is_active=? WHERE id=?',
        [pkg.name, pkg.liters, pkg.price, pkg.badge || '', pkg.isActive !== false ? 1 : 0, pkg.id]
      );
      return { ...pkg, id: Number(pkg.id) };
    } else {
      const [res] = await pool.query(
        'INSERT INTO packages (name, liters, price, badge, is_active) VALUES (?, ?, ?, ?, ?)',
        [pkg.name, pkg.liters, pkg.price, pkg.badge || '', 1]
      );
      return { ...pkg, id: res.insertId, isActive: true };
    }
  }

  // JSON fallback
  if (pkg.id) {
    const idx = memPackages.findIndex(p => p.id === Number(pkg.id));
    if (idx !== -1) {
      memPackages[idx] = { ...memPackages[idx], ...pkg, id: Number(pkg.id) };
    }
  } else {
    const newId = (memPackages.reduce((max, p) => Math.max(max, p.id || 0), 0)) + 1;
    memPackages.push({ ...pkg, id: newId, isActive: true });
  }
  fs.writeFileSync(PACKAGES_FILE, JSON.stringify(memPackages, null, 2));
  return pkg;
}

async function deletePackage(id) {
  if (isMySqlConnected) {
    await pool.query('DELETE FROM packages WHERE id=?', [id]);
    return true;
  }
  memPackages = memPackages.filter(p => p.id !== Number(id));
  fs.writeFileSync(PACKAGES_FILE, JSON.stringify(memPackages, null, 2));
  return true;
}

// =====================================
// TRANSACTIONS DAO
// =====================================
async function getTransactions(limit = 100) {
  if (isMySqlConnected) {
    const [rows] = await pool.query('SELECT * FROM transactions ORDER BY id DESC LIMIT ?', [limit]);
    return rows.map(r => ({
      id: r.id,
      orderId: r.order_id,
      merchantTransId: r.merchant_trans_id,
      customerName: r.customer_name,
      title: r.title,
      targetLiter: Number(r.target_liter),
      dispensedLiter: Number(r.dispensed_liter),
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      acquirementId: r.acquirement_id,
      durationSeconds: Number(r.duration_seconds),
      qrString: r.qr_string,
      checkoutUrl: r.checkout_url,
      createdAt: r.created_at,
      paidAt: r.paid_at,
      completedAt: r.completed_at
    }));
  }
  return memTransactions.slice(0, limit);
}

async function findTransaction(orderId) {
  if (isMySqlConnected) {
    const [rows] = await pool.query('SELECT * FROM transactions WHERE order_id=? OR merchant_trans_id=? LIMIT 1', [orderId, orderId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      orderId: r.order_id,
      merchantTransId: r.merchant_trans_id,
      customerName: r.customer_name,
      title: r.title,
      targetLiter: Number(r.target_liter),
      dispensedLiter: Number(r.dispensed_liter),
      amount: Number(r.amount),
      status: r.status,
      acquirementId: r.acquirement_id,
      createdAt: r.created_at,
      paidAt: r.paid_at
    };
  }
  return memTransactions.find(t => t.orderId === orderId || t.merchantTransId === orderId);
}

async function saveTransaction(tx) {
  if (isMySqlConnected) {
    await pool.query(`
      INSERT INTO transactions 
      (order_id, merchant_trans_id, customer_name, title, target_liter, dispensed_liter, amount, currency, status, qr_string, checkout_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tx.orderId,
      tx.merchantTransId || tx.orderId,
      tx.customerName || 'Pelanggan Depot',
      tx.title,
      tx.targetLiter,
      tx.dispensedLiter || 0,
      tx.amount,
      tx.currency || 'IDR',
      tx.status || 'PENDING',
      tx.qrString || '',
      tx.checkoutUrl || ''
    ]);
    return tx;
  }
  memTransactions.unshift(tx);
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(memTransactions.slice(0, 200), null, 2));
  return tx;
}

async function updateTransaction(orderId, updateFields) {
  if (isMySqlConnected) {
    const fields = [];
    const values = [];

    if (updateFields.status) { fields.push('status=?'); values.push(updateFields.status); }
    if (updateFields.paidAt) { fields.push('paid_at=?'); values.push(new Date(updateFields.paidAt)); }
    if (updateFields.completedAt) { fields.push('completed_at=?'); values.push(new Date(updateFields.completedAt)); }
    if (updateFields.dispensedLiter !== undefined) { fields.push('dispensed_liter=?'); values.push(updateFields.dispensedLiter); }
    if (updateFields.durationSeconds !== undefined) { fields.push('duration_seconds=?'); values.push(updateFields.durationSeconds); }
    if (updateFields.acquirementId) { fields.push('acquirement_id=?'); values.push(updateFields.acquirementId); }

    if (fields.length > 0) {
      values.push(orderId, orderId);
      await pool.query(`UPDATE transactions SET ${fields.join(', ')} WHERE order_id=? OR merchant_trans_id=?`, values);
    }
    return;
  }

  const tx = memTransactions.find(t => t.orderId === orderId || t.merchantTransId === orderId);
  if (tx) {
    Object.assign(tx, updateFields);
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(memTransactions.slice(0, 200), null, 2));
  }
}

// =====================================
// SETTINGS DAO
// =====================================
async function getSetting(key, defaultVal = null) {
  if (isMySqlConnected) {
    const [rows] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key=?', [key]);
    if (rows.length > 0) {
      try { return JSON.parse(rows[0].setting_value); } catch (e) { return rows[0].setting_value; }
    }
    return defaultVal;
  }
  return memSettings[key] !== undefined ? memSettings[key] : defaultVal;
}

async function setSetting(key, val) {
  const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (isMySqlConnected) {
    await pool.query('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=?', [key, strVal, strVal]);
  } else {
    memSettings[key] = val;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(memSettings, null, 2));
  }
}

// =====================================
// AUDIT LOGS DAO
// =====================================
async function addLog(source, type, message, payload = null) {
  const logItem = {
    id: 'LOG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toISOString(),
    source,
    type,
    message,
    payload
  };

  if (isMySqlConnected) {
    try {
      await pool.query('INSERT INTO audit_logs (log_id, source, type, message, payload) VALUES (?, ?, ?, ?, ?)', [
        logItem.id,
        source,
        type,
        message,
        payload ? JSON.stringify(payload) : null
      ]);
    } catch (e) {}
  }

  memLogs.unshift(logItem);
  if (memLogs.length > 250) memLogs.pop();
  fs.writeFileSync(LOGS_FILE, JSON.stringify(memLogs, null, 2));

  return logItem;
}

async function getLogs(limit = 100) {
  if (isMySqlConnected) {
    const [rows] = await pool.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?', [limit]);
    return rows.map(r => ({
      id: r.log_id,
      timestamp: r.created_at,
      source: r.source,
      type: r.type,
      message: r.message,
      payload: r.payload ? (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload) : null
    }));
  }
  return memLogs.slice(0, limit);
}

// Stats Calculation
async function getTodayStats() {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (isMySqlConnected) {
    const [rows] = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as totalRevenue,
        COALESCE(SUM(CASE WHEN dispensed_liter > 0 THEN dispensed_liter ELSE target_liter END), 0) as totalLiters,
        COUNT(*) as totalOrders
      FROM transactions 
      WHERE DATE(created_at) = CURDATE() AND status = 'COMPLETED'
    `);
    return {
      totalRevenueToday: Number(rows[0].totalRevenue || 0),
      totalWaterDispensedToday: Number(rows[0].totalLiters || 0),
      totalOrdersToday: Number(rows[0].totalOrders || 0)
    };
  }

  const todayTx = memTransactions.filter(t => t.createdAt && t.createdAt.startsWith(todayStr) && t.status === 'COMPLETED');
  return {
    totalRevenueToday: todayTx.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0),
    totalWaterDispensedToday: todayTx.reduce((acc, curr) => acc + (Number(curr.dispensedLiter) || Number(curr.targetLiter) || 0), 0),
    totalOrdersToday: todayTx.length
  };
}

module.exports = {
  initDB,
  isMySqlConnected: () => isMySqlConnected,
  getPackages,
  getAllPackagesAdmin,
  savePackage,
  deletePackage,
  getTransactions,
  findTransaction,
  saveTransaction,
  updateTransaction,
  getSetting,
  setSetting,
  addLog,
  getLogs,
  getTodayStats
};
