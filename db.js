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
const MACHINES_FILE = path.join(DATA_DIR, 'machines.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Default initial data
const DEFAULT_PACKAGES = [
  { id: 1, name: '1 Galon (19L)', liters: 19, price: 7000, badge: 'Populer', isActive: 1 },
  { id: 2, name: '2 Galon (38L)', liters: 38, price: 14000, badge: 'Hemat', isActive: 1 },
  { id: 3, name: 'Galon Mini (10L)', liters: 10, price: 4000, badge: 'Praktis', isActive: 1 }
];

const DEFAULT_USERS = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    name: 'Administrator Pusat',
    role: 'ADMIN',
    assignedMachineId: null,
    phone: '08123456789',
    isActive: 1,
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    username: 'mitra1',
    password: '123456',
    name: 'Mitra Cabang 1',
    role: 'CLIENT',
    assignedMachineId: 'DEPOT-001',
    phone: '08987654321',
    isActive: 1,
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_MACHINES = [
  {
    id: 'DEPOT-001',
    name: 'Depot Pusat (Prototipe)',
    location: 'Workshop Pusat',
    status: 'ONLINE',
    totalLiters: 0,
    totalRevenue: 0,
    filterLimitLiters: 10000,
    filterUsedLiters: 0,
    lastSeen: new Date().toISOString(),
    ip: '127.0.0.1',
    ssid: 'Ade',
    isActive: 1,
    createdAt: new Date().toISOString()
  }
];

let pool = null;
let isMySqlConnected = false;

// In-Memory fallbacks
let memPackages = [...DEFAULT_PACKAGES];
let memTransactions = [];
let memLogs = [];
let memMachines = [...DEFAULT_MACHINES];
let memUsers = [...DEFAULT_USERS];
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
  if (fs.existsSync(MACHINES_FILE)) memMachines = JSON.parse(fs.readFileSync(MACHINES_FILE, 'utf8'));
  if (fs.existsSync(USERS_FILE)) memUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
} catch (e) {}

async function initDB() {
  const dbHost = process.env.DB_HOST || '127.0.0.1';
  const dbUser = process.env.DB_USER;
  const dbPass = process.env.DB_PASS || process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'depotair';
  const dbPort = Number(process.env.DB_PORT) || 3306;

  if (dbHost && dbUser) {
    try {
      console.log(`🔌 Menghubungkan ke MySQL (${dbHost}:${dbPort}, DB: ${dbName}, User: ${dbUser})...`);

      // Buat Pool langsung ke database yang sudah di-grant hak aksesnya
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

      // Test koneksi
      const testConn = await pool.getConnection();
      console.log('✅ Berhasil terkoneksi ke server MySQL.');
      testConn.release();

      // Buat Tabel Otomatis di dalam database
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Migrasi: Tambahkan kolom device_id ke tabel transactions jika belum ada
      try {
        await pool.query('ALTER TABLE transactions ADD COLUMN device_id VARCHAR(50) DEFAULT "DEPOT-001"');
      } catch (e) {}

      await pool.query(`
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
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          setting_key VARCHAR(50) PRIMARY KEY,
          setting_value TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          role VARCHAR(20) DEFAULT 'CLIENT',
          assigned_machine_id VARCHAR(50) DEFAULT NULL,
          phone VARCHAR(50) DEFAULT '',
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Seed user awal jika masih kosong
      const [uRows] = await pool.query('SELECT COUNT(*) as count FROM users');
      if (uRows[0].count === 0) {
        await pool.query(
          'INSERT INTO users (username, password, name, role, assigned_machine_id, phone, is_active) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)',
          [
            'admin', 'admin123', 'Administrator Pusat', 'ADMIN', null, '08123456789', 1,
            'mitra1', '123456', 'Mitra Cabang 1', 'CLIENT', 'DEPOT-001', '08987654321', 1
          ]
        );
        console.log('🌱 Seed default users: admin (Superadmin) dan mitra1 (Client Cabang 1)');
      }

      // Seed mesin awal jika masih kosong
      const [machRows] = await pool.query('SELECT COUNT(*) as count FROM depot_machines');
      if (machRows[0].count === 0) {
        await pool.query(
          'INSERT INTO depot_machines (id, name, location, status, filter_limit_liters) VALUES (?, ?, ?, ?, ?)',
          ['DEPOT-001', 'Depot Pusat (Prototipe)', 'Kantor Pusat / Workshop', 'ONLINE', 10000]
        );
      }

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
      console.log(`🎉 DATABASE MYSQL "${dbName}" SIAP DIGUNAKAN!`);
    } catch (error) {
      console.error('⚠️ Peringatan MySQL:', error.message);
      console.log('🔄 Server tetap berjalan normal menggunakan JSON Storage (data/)...');
      isMySqlConnected = false;
    }
  } else {
    console.log('ℹ️ Menggunakan JSON Storage (data/)');
    isMySqlConnected = false;
  }
}

// =====================================
// PACKAGES DAO (HARGA & LITERAN AIR)
// =====================================
async function getPackages() {
  if (isMySqlConnected) {
    try {
      const [rows] = await pool.query('SELECT * FROM packages WHERE is_active = 1 ORDER BY liters ASC');
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        liters: Number(r.liters),
        price: Number(r.price),
        badge: r.badge,
        isActive: Boolean(r.is_active)
      }));
    } catch (e) {
      console.error('MySQL getPackages error:', e.message);
    }
  }
  return memPackages.filter(p => p.isActive);
}

async function getAllPackagesAdmin() {
  if (isMySqlConnected) {
    try {
      const [rows] = await pool.query('SELECT * FROM packages ORDER BY liters ASC');
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        liters: Number(r.liters),
        price: Number(r.price),
        badge: r.badge,
        isActive: Boolean(r.is_active)
      }));
    } catch (e) {
      console.error('MySQL getAllPackagesAdmin error:', e.message);
    }
  }
  return memPackages;
}

async function savePackage(pkg) {
  if (isMySqlConnected) {
    try {
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
    } catch (e) {
      console.error('MySQL savePackage error:', e.message);
    }
  }

  if (pkg.id) {
    const idx = memPackages.findIndex(p => p.id === Number(pkg.id));
    if (idx !== -1) {
      memPackages[idx] = { ...memPackages[idx], ...pkg, id: Number(pkg.id) };
    }
  } else {
    const newId = (memPackages.reduce((max, p) => Math.max(max, p.id || 0), 0)) + 1;
    memPackages.push({ ...pkg, id: newId, isActive: true });
  }
  try { fs.writeFileSync(PACKAGES_FILE, JSON.stringify(memPackages, null, 2)); } catch (e) {}
  return pkg;
}

async function deletePackage(id) {
  if (isMySqlConnected) {
    try {
      await pool.query('DELETE FROM packages WHERE id=?', [id]);
      return true;
    } catch (e) {
      console.error('MySQL deletePackage error:', e.message);
    }
  }
  memPackages = memPackages.filter(p => p.id !== Number(id));
  try { fs.writeFileSync(PACKAGES_FILE, JSON.stringify(memPackages, null, 2)); } catch (e) {}
  return true;
}

// =====================================
// TRANSACTIONS DAO
// =====================================
async function getTransactions(limit = 100, deviceId = null) {
  if (isMySqlConnected) {
    try {
      let query = 'SELECT * FROM transactions';
      const params = [];
      if (deviceId) {
        query += ' WHERE device_id = ?';
        params.push(deviceId);
      }
      query += ' ORDER BY id DESC LIMIT ?';
      params.push(limit);

      const [rows] = await pool.query(query, params);
      return rows.map(r => ({
        id: r.id,
        orderId: r.order_id,
        merchantTransId: r.merchant_trans_id,
        deviceId: r.device_id || 'DEPOT-001',
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
    } catch (e) {
      console.error('MySQL getTransactions error:', e.message);
    }
  }
  let txs = memTransactions;
  if (deviceId) {
    txs = txs.filter(t => (t.deviceId || 'DEPOT-001') === deviceId);
  }
  return txs.slice(0, limit);
}

async function findTransaction(orderId) {
  if (isMySqlConnected) {
    try {
      const [rows] = await pool.query('SELECT * FROM transactions WHERE order_id=? OR merchant_trans_id=? LIMIT 1', [orderId, orderId]);
      if (rows.length > 0) {
        const r = rows[0];
        return {
          id: r.id,
          orderId: r.order_id,
          merchantTransId: r.merchant_trans_id,
          deviceId: r.device_id || 'DEPOT-001',
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
    } catch (e) {
      console.error('MySQL findTransaction error:', e.message);
    }
  }
  return memTransactions.find(t => t.orderId === orderId || t.merchantTransId === orderId);
}

async function saveTransaction(tx) {
  const machineId = tx.deviceId || tx.machineId || 'DEPOT-001';
  tx.deviceId = machineId;

  if (isMySqlConnected) {
    try {
      await pool.query(`
        INSERT INTO transactions 
        (order_id, merchant_trans_id, device_id, customer_name, title, target_liter, dispensed_liter, amount, currency, status, qr_string, checkout_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tx.orderId,
        tx.merchantTransId || tx.orderId,
        machineId,
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
    } catch (e) {
      console.error('MySQL saveTransaction error:', e.message);
    }
  }
  memTransactions.unshift(tx);
  try { fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(memTransactions.slice(0, 200), null, 2)); } catch (e) {}
  return tx;
}

async function updateTransaction(orderId, updateFields) {
  if (isMySqlConnected) {
    try {
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
    } catch (e) {
      console.error('MySQL updateTransaction error:', e.message);
    }
  }

  const tx = memTransactions.find(t => t.orderId === orderId || t.merchantTransId === orderId);
  if (tx) {
    Object.assign(tx, updateFields);
    try { fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(memTransactions.slice(0, 200), null, 2)); } catch (e) {}
  }
}

// =====================================
// SETTINGS DAO
// =====================================
async function getSetting(key, defaultVal = null) {
  if (isMySqlConnected) {
    try {
      const [rows] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key=?', [key]);
      if (rows.length > 0) {
        try { return JSON.parse(rows[0].setting_value); } catch (e) { return rows[0].setting_value; }
      }
      return defaultVal;
    } catch (e) {
      console.error('MySQL getSetting error:', e.message);
    }
  }
  return memSettings[key] !== undefined ? memSettings[key] : defaultVal;
}

async function setSetting(key, val) {
  const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (isMySqlConnected) {
    try {
      await pool.query('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=?', [key, strVal, strVal]);
      return;
    } catch (e) {
      console.error('MySQL setSetting error:', e.message);
    }
  }
  memSettings[key] = val;
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(memSettings, null, 2)); } catch (e) {}
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
  try { fs.writeFileSync(LOGS_FILE, JSON.stringify(memLogs, null, 2)); } catch (e) {}

  return logItem;
}

async function getLogs(limit = 100) {
  if (isMySqlConnected) {
    try {
      const [rows] = await pool.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?', [limit]);
      return rows.map(r => ({
        id: r.log_id,
        timestamp: r.created_at,
        source: r.source,
        type: r.type,
        message: r.message,
        payload: r.payload ? (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload) : null
      }));
    } catch (e) {
      console.error('MySQL getLogs error:', e.message);
    }
  }
  return memLogs.slice(0, limit);
}

// Stats Calculation (Bisa per Device ID untuk Client, atau Global untuk Admin)
async function getTodayStats(deviceId = null) {
  if (isMySqlConnected) {
    try {
      let query = `
        SELECT 
          COALESCE(SUM(amount), 0) as totalRevenue,
          COALESCE(SUM(CASE WHEN dispensed_liter > 0 THEN dispensed_liter ELSE target_liter END), 0) as totalLiters,
          COUNT(*) as totalOrders
        FROM transactions 
        WHERE DATE(created_at) = CURDATE() AND status = 'COMPLETED'
      `;
      const params = [];
      if (deviceId) {
        query += ' AND device_id = ?';
        params.push(deviceId);
      }
      const [rows] = await pool.query(query, params);
      return {
        totalRevenueToday: Number(rows[0].totalRevenue || 0),
        totalWaterDispensedToday: Number(rows[0].totalLiters || 0),
        totalOrdersToday: Number(rows[0].totalOrders || 0)
      };
    } catch (e) {
      console.error('MySQL getTodayStats error:', e.message);
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  let todayTx = memTransactions.filter(t => t.createdAt && t.createdAt.startsWith(todayStr) && t.status === 'COMPLETED');
  if (deviceId) {
    todayTx = todayTx.filter(t => (t.deviceId || 'DEPOT-001') === deviceId);
  }
  return {
    totalRevenueToday: todayTx.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0),
    totalWaterDispensedToday: todayTx.reduce((acc, curr) => acc + (Number(curr.dispensedLiter) || Number(curr.targetLiter) || 0), 0),
    totalOrdersToday: todayTx.length
  };
}

// =====================================
// DEPOT MACHINES (MULTI-CABANG FLEET)
// =====================================
async function getMachines(filterDeviceId = null) {
  if (isMySqlConnected) {
    try {
      let query = 'SELECT * FROM depot_machines';
      const params = [];
      if (filterDeviceId) {
        query += ' WHERE id = ?';
        params.push(filterDeviceId);
      }
      query += ' ORDER BY id ASC';
      const [rows] = await pool.query(query, params);
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        location: r.location,
        status: r.status,
        totalLiters: Number(r.total_liters || 0),
        totalRevenue: Number(r.total_revenue || 0),
        filterLimitLiters: Number(r.filter_limit_liters || 10000),
        filterUsedLiters: Number(r.filter_used_liters || 0),
        lastSeen: r.last_seen,
        ip: r.ip,
        ssid: r.ssid,
        isActive: r.is_active === 1,
        createdAt: r.created_at
      }));
    } catch (e) {
      console.error('MySQL getMachines error:', e.message);
    }
  }
  if (filterDeviceId) {
    return memMachines.filter(m => m.id === filterDeviceId);
  }
  return memMachines;
}

async function getMachine(id) {
  if (isMySqlConnected) {
    try {
      const [rows] = await pool.query('SELECT * FROM depot_machines WHERE id = ? LIMIT 1', [id]);
      if (rows.length > 0) {
        const r = rows[0];
        return {
          id: r.id,
          name: r.name,
          location: r.location,
          status: r.status,
          totalLiters: Number(r.total_liters || 0),
          totalRevenue: Number(r.total_revenue || 0),
          filterLimitLiters: Number(r.filter_limit_liters || 10000),
          filterUsedLiters: Number(r.filter_used_liters || 0),
          lastSeen: r.last_seen,
          ip: r.ip,
          ssid: r.ssid,
          isActive: r.is_active === 1,
          createdAt: r.created_at
        };
      }
    } catch (e) {
      console.error('MySQL getMachine error:', e.message);
    }
  }
  return memMachines.find(m => m.id === id);
}

async function saveMachine(machine) {
  const { id, name, location, filterLimitLiters } = machine;
  const filterLimit = Number(filterLimitLiters) || 10000;

  if (isMySqlConnected) {
    try {
      await pool.query(`
        INSERT INTO depot_machines (id, name, location, filter_limit_liters)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          name = VALUES(name),
          location = VALUES(location),
          filter_limit_liters = VALUES(filter_limit_liters)
      `, [id, name, location || '', filterLimit]);
      return getMachine(id);
    } catch (e) {
      console.error('MySQL saveMachine error:', e.message);
    }
  }

  const existingIdx = memMachines.findIndex(m => m.id === id);
  const updatedItem = {
    id,
    name,
    location: location || '',
    status: existingIdx >= 0 ? memMachines[existingIdx].status : 'OFFLINE',
    totalLiters: existingIdx >= 0 ? memMachines[existingIdx].totalLiters : 0,
    totalRevenue: existingIdx >= 0 ? memMachines[existingIdx].totalRevenue : 0,
    filterLimitLiters: filterLimit,
    filterUsedLiters: existingIdx >= 0 ? memMachines[existingIdx].filterUsedLiters : 0,
    lastSeen: existingIdx >= 0 ? memMachines[existingIdx].lastSeen : null,
    ip: existingIdx >= 0 ? memMachines[existingIdx].ip : null,
    ssid: existingIdx >= 0 ? memMachines[existingIdx].ssid : null,
    isActive: 1,
    createdAt: existingIdx >= 0 ? memMachines[existingIdx].createdAt : new Date().toISOString()
  };

  if (existingIdx >= 0) {
    memMachines[existingIdx] = updatedItem;
  } else {
    memMachines.push(updatedItem);
  }
  try { fs.writeFileSync(MACHINES_FILE, JSON.stringify(memMachines, null, 2)); } catch (e) {}
  return updatedItem;
}

async function deleteMachine(id) {
  if (id === 'DEPOT-001') {
    throw new Error('Mesin default DEPOT-001 tidak boleh dihapus.');
  }
  if (isMySqlConnected) {
    try {
      await pool.query('DELETE FROM depot_machines WHERE id = ?', [id]);
    } catch (e) {
      console.error('MySQL deleteMachine error:', e.message);
    }
  }
  memMachines = memMachines.filter(m => m.id !== id);
  try { fs.writeFileSync(MACHINES_FILE, JSON.stringify(memMachines, null, 2)); } catch (e) {}
  return true;
}

async function updateMachineStatus(id, { status, ip, ssid, lastSeen }) {
  const seenTime = lastSeen ? new Date(lastSeen) : new Date();
  if (isMySqlConnected) {
    try {
      await pool.query(`
        UPDATE depot_machines 
        SET status = COALESCE(?, status),
            ip = COALESCE(?, ip),
            ssid = COALESCE(?, ssid),
            last_seen = ?
        WHERE id = ?
      `, [status, ip, ssid, seenTime, id]);
    } catch (e) {
      console.error('MySQL updateMachineStatus error:', e.message);
    }
  }

  const m = memMachines.find(item => item.id === id);
  if (m) {
    if (status) m.status = status;
    if (ip) m.ip = ip;
    if (ssid) m.ssid = ssid;
    m.lastSeen = seenTime.toISOString();
    try { fs.writeFileSync(MACHINES_FILE, JSON.stringify(memMachines, null, 2)); } catch (e) {}
  }
}

async function incrementMachineUsage(id, liters, revenue) {
  const l = Number(liters) || 0;
  const r = Number(revenue) || 0;
  if (isMySqlConnected) {
    try {
      await pool.query(`
        UPDATE depot_machines 
        SET total_liters = total_liters + ?,
            total_revenue = total_revenue + ?,
            filter_used_liters = filter_used_liters + ?
        WHERE id = ?
      `, [l, r, l, id]);
    } catch (e) {
      console.error('MySQL incrementMachineUsage error:', e.message);
    }
  }

  const m = memMachines.find(item => item.id === id);
  if (m) {
    m.totalLiters = (Number(m.totalLiters) || 0) + l;
    m.totalRevenue = (Number(m.totalRevenue) || 0) + r;
    m.filterUsedLiters = (Number(m.filterUsedLiters) || 0) + l;
    try { fs.writeFileSync(MACHINES_FILE, JSON.stringify(memMachines, null, 2)); } catch (e) {}
  }
}

async function resetMachineFilter(id) {
  if (isMySqlConnected) {
    try {
      await pool.query('UPDATE depot_machines SET filter_used_liters = 0 WHERE id = ?', [id]);
    } catch (e) {
      console.error('MySQL resetMachineFilter error:', e.message);
    }
  }

  const m = memMachines.find(item => item.id === id);
  if (m) {
    m.filterUsedLiters = 0;
    try { fs.writeFileSync(MACHINES_FILE, JSON.stringify(memMachines, null, 2)); } catch (e) {}
  }
  return true;
}

// =====================================
// USERS & MULTI-TENANT RBAC DAO
// =====================================
async function getUsers() {
  if (isMySqlConnected) {
    try {
      const [rows] = await pool.query('SELECT id, username, name, role, assigned_machine_id, phone, is_active, created_at FROM users ORDER BY id ASC');
      return rows.map(r => ({
        id: r.id,
        username: r.username,
        name: r.name,
        role: r.role,
        assignedMachineId: r.assigned_machine_id,
        phone: r.phone,
        isActive: r.is_active === 1,
        createdAt: r.created_at
      }));
    } catch (e) {
      console.error('MySQL getUsers error:', e.message);
    }
  }
  return memUsers.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    assignedMachineId: u.assignedMachineId,
    phone: u.phone,
    isActive: u.isActive === 1,
    createdAt: u.createdAt
  }));
}

async function getUserByUsername(username) {
  if (isMySqlConnected) {
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
      if (rows.length > 0) {
        const r = rows[0];
        return {
          id: r.id,
          username: r.username,
          password: r.password,
          name: r.name,
          role: r.role,
          assignedMachineId: r.assigned_machine_id,
          phone: r.phone,
          isActive: r.is_active === 1,
          createdAt: r.created_at
        };
      }
    } catch (e) {
      console.error('MySQL getUserByUsername error:', e.message);
    }
  }
  return memUsers.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}

async function validateUser(username, password) {
  const user = await getUserByUsername(username);
  if (!user) return null;
  if (user.password === password) {
    const { password: _, ...safeUser } = user;
    return safeUser;
  }
  return null;
}

async function saveUser(userData) {
  const { id, username, password, name, role, assignedMachineId, phone } = userData;
  const cleanRole = role === 'ADMIN' ? 'ADMIN' : 'CLIENT';
  const cleanMachine = cleanRole === 'ADMIN' ? null : (assignedMachineId || null);

  if (isMySqlConnected) {
    try {
      if (id) {
        if (password) {
          await pool.query(
            'UPDATE users SET username=?, password=?, name=?, role=?, assigned_machine_id=?, phone=? WHERE id=?',
            [username, password, name, cleanRole, cleanMachine, phone || '', id]
          );
        } else {
          await pool.query(
            'UPDATE users SET username=?, name=?, role=?, assigned_machine_id=?, phone=? WHERE id=?',
            [username, name, cleanRole, cleanMachine, phone || '', id]
          );
        }
        return { id: Number(id), username, name, role: cleanRole, assignedMachineId: cleanMachine, phone };
      } else {
        const [res] = await pool.query(
          'INSERT INTO users (username, password, name, role, assigned_machine_id, phone, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
          [username, password, name, cleanRole, cleanMachine, phone || '']
        );
        return { id: res.insertId, username, name, role: cleanRole, assignedMachineId: cleanMachine, phone };
      }
    } catch (e) {
      console.error('MySQL saveUser error:', e.message);
      throw e;
    }
  }

  if (id) {
    const idx = memUsers.findIndex(u => u.id === Number(id));
    if (idx !== -1) {
      memUsers[idx] = { 
        ...memUsers[idx], 
        username, 
        name, 
        role: cleanRole, 
        assignedMachineId: cleanMachine, 
        phone: phone || '',
        ...(password ? { password } : {})
      };
    }
  } else {
    const newId = (memUsers.reduce((max, u) => Math.max(max, u.id || 0), 0)) + 1;
    memUsers.push({
      id: newId,
      username,
      password: password || '123456',
      name,
      role: cleanRole,
      assignedMachineId: cleanMachine,
      phone: phone || '',
      isActive: 1,
      createdAt: new Date().toISOString()
    });
  }
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(memUsers, null, 2)); } catch (e) {}
  return userData;
}

async function deleteUser(id) {
  if (id === 1) throw new Error('User Super Admin utama tidak boleh dihapus!');
  if (isMySqlConnected) {
    try {
      await pool.query('DELETE FROM users WHERE id=?', [id]);
      return true;
    } catch (e) {
      console.error('MySQL deleteUser error:', e.message);
    }
  }
  memUsers = memUsers.filter(u => u.id !== Number(id));
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(memUsers, null, 2)); } catch (e) {}
  return true;
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
  getTodayStats,
  getMachines,
  getMachine,
  saveMachine,
  deleteMachine,
  updateMachineStatus,
  incrementMachineUsage,
  resetMachineFilter,
  getUsers,
  getUserByUsername,
  validateUser,
  saveUser,
  deleteUser
};
