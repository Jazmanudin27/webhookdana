const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3005;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Load stored data or initialize
let transactions = [];
let auditLogs = [];
let deviceSettings = {
  wifiSsid: 'WiFi_Depot_Air',
  wifiPassword: '',
  pulsesPerLiter: 450,
  pendingWifiUpdate: null // { ssid, password, timestamp }
};

try {
  if (fs.existsSync(TRANSACTIONS_FILE)) {
    transactions = JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8'));
  }
} catch (e) {
  transactions = [];
}

try {
  if (fs.existsSync(LOGS_FILE)) {
    auditLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
  }
} catch (e) {
  auditLogs = [];
}

try {
  if (fs.existsSync(SETTINGS_FILE)) {
    deviceSettings = { ...deviceSettings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
  }
} catch (e) {
  console.error('Error reading settings.json:', e.message);
}

function saveTransactions() {
  try {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions.slice(-200), null, 2));
  } catch (e) {}
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(deviceSettings, null, 2));
  } catch (e) {}
}

function addLog(source, type, message, payload = null) {
  const logItem = {
    id: 'LOG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toISOString(),
    source, // 'DANA_WEBHOOK', 'ESP32', 'SYSTEM', 'DASHBOARD'
    type,   // 'INFO', 'SUCCESS', 'WARNING', 'ERROR'
    message,
    payload
  };
  auditLogs.unshift(logItem);
  if (auditLogs.length > 300) auditLogs.pop();
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(auditLogs.slice(0, 300), null, 2));
  } catch (e) {}

  io.emit('log:new', logItem);
  return logItem;
}

// System State
let currentState = {
  status: 'IDLE', // 'IDLE' | 'PAID' | 'FILLING' | 'EMERGENCY_STOP'
  activeOrder: null,
  esp32LastSeen: null,
  esp32Ip: null,
  esp32Status: 'OFFLINE',
  esp32CurrentSsid: null,
  totalWaterDispensedToday: 0,
  totalRevenueToday: 0
};

// Calculate initial today stats
function updateTodayStats() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTx = transactions.filter(t => t.createdAt && t.createdAt.startsWith(todayStr) && t.status === 'COMPLETED');
  currentState.totalWaterDispensedToday = todayTx.reduce((acc, curr) => acc + (Number(curr.dispensedLiter) || Number(curr.targetLiter) || 0), 0);
  currentState.totalRevenueToday = todayTx.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
}
updateTodayStats();

// ESP32 Heartbeat Monitor
setInterval(() => {
  if (currentState.esp32LastSeen) {
    const elapsed = Date.now() - new Date(currentState.esp32LastSeen).getTime();
    const wasOnline = currentState.esp32Status === 'ONLINE';
    if (elapsed > 10000) { // 10s timeout
      currentState.esp32Status = 'OFFLINE';
      if (wasOnline) {
        addLog('ESP32', 'WARNING', 'ESP32 Device Terputus (Heartbeat Timeout)');
        io.emit('system:state', currentState);
      }
    } else {
      currentState.esp32Status = 'ONLINE';
    }
  }
}, 3000);

// ==========================================
// 1. DANA SANDBOX WEBHOOK & ORDER ENDPOINTS
// ==========================================

app.post('/api/dana/create-order', (req, res) => {
  try {
    const { packageType, customLiter, customerName } = req.body;
    
    let targetLiter = 19;
    let amount = 7000;
    let title = 'Isi Ulang 1 Galon (19L)';

    if (packageType === '2_GALON' || customLiter === 38) {
      targetLiter = 38;
      amount = 14000;
      title = 'Isi Ulang 2 Galon (38L)';
    } else if (packageType === 'CUSTOM' && customLiter > 0) {
      targetLiter = Number(customLiter);
      amount = Math.round((targetLiter / 19) * 7000);
      title = `Isi Ulang Custom (${targetLiter}L)`;
    }

    const orderId = 'DANA-DEPOT-' + Date.now();
    const newOrder = {
      orderId,
      merchantTransId: orderId,
      customerName: customerName || 'Pelanggan Depot Air',
      title,
      targetLiter,
      amount,
      currency: 'IDR',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      paidAt: null,
      completedAt: null,
      dispensedLiter: 0,
      qrString: `00020101021226670016ID.DANA.WWW01189360000000000000000215${orderId}520454115303360540${amount}.005802ID5914DEPOT AIR DANA6007JAKARTA6304ABCD`,
      checkoutUrl: `${PUBLIC_BASE_URL}/checkout/${orderId}`
    };

    transactions.unshift(newOrder);
    saveTransactions();

    addLog('DASHBOARD', 'INFO', `Order baru dibuat: ${orderId} (${title} - Rp ${amount.toLocaleString('id-ID')})`, newOrder);
    io.emit('order:created', newOrder);

    return res.status(201).json({
      success: true,
      message: 'Order berhasil dibuat',
      data: newOrder
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/dana/finish-notify', (req, res) => {
  try {
    const rawBody = req.body;
    let merchantTransId = null;
    let acquirementId = null;
    let amountVal = null;

    if (rawBody.response && rawBody.response.body) {
      const b = rawBody.response.body;
      merchantTransId = b.merchantTransId || (b.orderInfo && b.orderInfo.merchantTransId);
      acquirementId = b.acquirementId;
      amountVal = b.amount ? Number(b.amount.value) : null;
    } else {
      merchantTransId = rawBody.merchantTransId || rawBody.orderId || rawBody.order_id;
      acquirementId = rawBody.acquirementId || rawBody.transaction_id || 'DANA-ACQ-' + Date.now();
      amountVal = rawBody.amount || rawBody.totalAmount;
    }

    addLog('DANA_WEBHOOK', 'SUCCESS', `Webhook Finish-Notify diterima untuk Order: ${merchantTransId || 'Unknown'}`, rawBody);

    let order = transactions.find(t => t.orderId === merchantTransId || t.merchantTransId === merchantTransId);

    if (!order) {
      const liter = amountVal >= 14000 ? 38 : 19;
      order = {
        orderId: merchantTransId || 'DANA-AUTO-' + Date.now(),
        merchantTransId: merchantTransId || 'DANA-AUTO-' + Date.now(),
        customerName: 'DANA Customer Sandbox',
        title: liter === 38 ? 'Isi Ulang 2 Galon (38L)' : 'Isi Ulang 1 Galon (19L)',
        targetLiter: liter,
        amount: amountVal || (liter === 38 ? 14000 : 7000),
        currency: 'IDR',
        status: 'PAID',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        completedAt: null,
        dispensedLiter: 0,
        acquirementId
      };
      transactions.unshift(order);
    } else {
      order.status = 'PAID';
      order.paidAt = new Date().toISOString();
      order.acquirementId = acquirementId;
      if (amountVal) order.amount = Number(amountVal);
    }

    saveTransactions();

    currentState.status = 'PAID';
    currentState.activeOrder = {
      orderId: order.orderId,
      targetLiter: order.targetLiter,
      amount: order.amount,
      title: order.title,
      customerName: order.customerName,
      paidAt: order.paidAt
    };

    io.emit('order:paid', order);
    io.emit('system:state', currentState);

    addLog('SYSTEM', 'SUCCESS', `Pembayaran DANA Dikonfirmasi! Mengantrikan Dispenser ESP32: ${order.targetLiter} Liter`, currentState.activeOrder);

    return res.status(200).json({
      response: {
        head: {
          version: '2.0',
          function: 'dana.acquirement.order.finishNotify',
          respTime: new Date().toISOString()
        },
        body: {
          resultInfo: {
            resultStatus: 'S',
            resultCode: 'SUCCESS',
            resultMsg: 'Success'
          },
          merchantTransId: order.merchantTransId,
          acquirementId: acquirementId || 'DANA-SANDBOX-SUCCESS'
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      response: { body: { resultInfo: { resultStatus: 'F', resultCode: 'FAILED', resultMsg: error.message } } }
    });
  }
});

app.post('/api/dana/simulate-pay', (req, res) => {
  const { orderId } = req.body;
  let targetOrder = transactions.find(t => t.orderId === orderId);

  if (!targetOrder) {
    const newOrderId = 'DANA-SIM-' + Date.now();
    targetOrder = {
      orderId: newOrderId,
      merchantTransId: newOrderId,
      customerName: 'Simulasi User',
      title: 'Isi Ulang 1 Galon (19L)',
      targetLiter: 19,
      amount: 7000,
      currency: 'IDR',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    transactions.unshift(targetOrder);
  }

  targetOrder.status = 'PAID';
  targetOrder.paidAt = new Date().toISOString();
  saveTransactions();

  currentState.status = 'PAID';
  currentState.activeOrder = {
    orderId: targetOrder.orderId,
    targetLiter: targetOrder.targetLiter,
    amount: targetOrder.amount,
    title: targetOrder.title,
    customerName: targetOrder.customerName,
    paidAt: targetOrder.paidAt
  };

  addLog('DANA_WEBHOOK', 'SUCCESS', `[SIMULASI] Pembayaran Sukses DANA Sandbox untuk Order: ${targetOrder.orderId}`, targetOrder);

  io.emit('order:paid', targetOrder);
  io.emit('system:state', currentState);

  return res.json({
    success: true,
    message: 'Simulasi pembayaran DANA Sandbox sukses!',
    order: targetOrder
  });
});

// ==========================================
// 2. ESP32 POLLING & WIFI SETTINGS API
// ==========================================

/**
 * Endpoint: /api/esp32/check-order
 * ESP32 polling setiap 2 detik. Jika ada instruksi ganti WiFi, server mengembalikan command UPDATE_WIFI
 */
app.get('/api/esp32/check-order', (req, res) => {
  currentState.esp32LastSeen = new Date().toISOString();
  currentState.esp32Ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ESP32-Client';
  currentState.esp32Status = 'ONLINE';

  if (req.query.ssid) {
    currentState.esp32CurrentSsid = req.query.ssid;
  }

  // 1. Cek apakah ada antrean instruksi Ganti WiFi dari Dashboard
  if (deviceSettings.pendingWifiUpdate) {
    const updatePayload = {
      status: 'UPDATE_WIFI',
      wifiSsid: deviceSettings.pendingWifiUpdate.ssid,
      wifiPassword: deviceSettings.pendingWifiUpdate.password,
      serverTime: Date.now()
    };
    // Hapus pending setelah dikirim ke ESP32
    deviceSettings.pendingWifiUpdate = null;
    saveSettings();
    addLog('SYSTEM', 'INFO', `Instruksi ganti WiFi terkirim ke ESP32 -> SSID: ${updatePayload.wifiSsid}`);
    return res.status(200).json(updatePayload);
  }

  // 2. Cek apakah ada antrean order PAID
  if (currentState.status === 'PAID' && currentState.activeOrder) {
    return res.status(200).json({
      status: 'PAID',
      orderId: currentState.activeOrder.orderId,
      targetLiter: currentState.activeOrder.targetLiter,
      price: currentState.activeOrder.amount,
      productName: currentState.activeOrder.title,
      serverTime: Date.now()
    });
  }

  // 3. Status Standby / IDLE
  return res.status(200).json({
    status: currentState.status === 'FILLING' ? 'FILLING' : 'IDLE',
    orderId: currentState.activeOrder ? currentState.activeOrder.orderId : null,
    targetLiter: currentState.activeOrder ? currentState.activeOrder.targetLiter : 0,
    serverTime: Date.now()
  });
});

app.post('/api/esp32/finish-fill', (req, res) => {
  try {
    const { orderId, dispensedLiter, durationSeconds, status: fillStatus } = req.body;
    const actualLiter = Number(dispensedLiter) || 0;
    const isEmergency = fillStatus === 'EMERGENCY_STOP';

    const order = transactions.find(t => t.orderId === orderId);
    if (order) {
      order.status = isEmergency ? 'STOPPED' : 'COMPLETED';
      order.dispensedLiter = actualLiter;
      order.durationSeconds = durationSeconds || 0;
      order.completedAt = new Date().toISOString();
      saveTransactions();
    }

    if (isEmergency) {
      addLog('ESP32', 'WARNING', `Pengisian dihentikan darurat: ${orderId} (${actualLiter}L)`, req.body);
    } else {
      addLog('ESP32', 'SUCCESS', `Pengisian Air Selesai: ${orderId} (${actualLiter}L)`, req.body);
    }

    currentState.status = 'IDLE';
    currentState.activeOrder = null;
    updateTodayStats();

    io.emit('order:completed', {
      orderId,
      dispensedLiter: actualLiter,
      status: isEmergency ? 'STOPPED' : 'COMPLETED',
      completedAt: new Date().toISOString()
    });
    io.emit('system:state', currentState);

    return res.status(200).json({ success: true, status: 'IDLE' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/esp32/telemetry', (req, res) => {
  const { currentLiter, flowRate, pulses, orderId } = req.body;
  if (currentState.status === 'PAID') currentState.status = 'FILLING';
  
  io.emit('esp32:telemetry', {
    orderId: orderId || (currentState.activeOrder ? currentState.activeOrder.orderId : null),
    currentLiter: Number(currentLiter) || 0,
    flowRate: Number(flowRate) || 0,
    pulses: Number(pulses) || 0,
    timestamp: Date.now()
  });

  return res.json({ ok: true });
});

// Endpoint untuk Dashboard mengubah konfigurasi WiFi ESP32
app.post('/api/device/save-wifi', (req, res) => {
  const { ssid, password } = req.body;
  if (!ssid) {
    return res.status(400).json({ success: false, message: 'Nama WiFi (SSID) tidak boleh kosong!' });
  }

  deviceSettings.wifiSsid = ssid;
  deviceSettings.wifiPassword = password || '';
  deviceSettings.pendingWifiUpdate = {
    ssid,
    password: password || '',
    updatedAt: new Date().toISOString()
  };
  saveSettings();

  addLog('DASHBOARD', 'SUCCESS', `Pengaturan WiFi baru disimpan di Web: SSID "${ssid}". Perintah update dijadwalkan ke ESP32.`);

  return res.json({
    success: true,
    message: `Pengaturan WiFi untuk "${ssid}" berhasil disimpan. ESP32 akan otomatis berganti ke WiFi baru pada polling berikutnya!`,
    data: {
      ssid: deviceSettings.wifiSsid,
      hasPassword: Boolean(deviceSettings.wifiPassword)
    }
  });
});

app.get('/api/device/settings', (req, res) => {
  return res.json({
    success: true,
    data: {
      wifiSsid: deviceSettings.wifiSsid,
      hasPassword: Boolean(deviceSettings.wifiPassword),
      pendingWifiUpdate: Boolean(deviceSettings.pendingWifiUpdate),
      esp32CurrentSsid: currentState.esp32CurrentSsid
    }
  });
});

app.post('/api/depot/emergency-stop', (req, res) => {
  const previousOrder = currentState.activeOrder;
  currentState.status = 'IDLE';
  currentState.activeOrder = null;

  if (previousOrder) {
    const order = transactions.find(t => t.orderId === previousOrder.orderId);
    if (order) {
      order.status = 'STOPPED';
      order.completedAt = new Date().toISOString();
      saveTransactions();
    }
  }

  addLog('DASHBOARD', 'WARNING', 'Emergency Stop diaktifkan manual dari Dashboard!');
  io.emit('system:state', currentState);

  return res.json({ success: true, message: 'Emergency Stop dieksekusi' });
});

// ==========================================
// 3. STATS & STATIC ASSETS
// ==========================================

app.get('/api/status', (req, res) => {
  updateTodayStats();
  return res.json({
    success: true,
    data: {
      ...currentState,
      serverTime: new Date().toISOString(),
      publicBaseUrl: PUBLIC_BASE_URL,
      webhookEndpoint: `${PUBLIC_BASE_URL}/api/dana/finish-notify`,
      esp32CheckEndpoint: `${PUBLIC_BASE_URL}/api/esp32/check-order`,
      esp32FinishEndpoint: `${PUBLIC_BASE_URL}/api/esp32/finish-fill`,
      configuredWifiSsid: deviceSettings.wifiSsid
    }
  });
});

app.get('/api/transactions', (req, res) => {
  return res.json({ success: true, total: transactions.length, data: transactions });
});

app.get('/api/logs', (req, res) => {
  return res.json({ success: true, total: auditLogs.length, data: auditLogs });
});

const clientDistPath = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.use(express.static(path.join(__dirname, 'public')));
}

io.on('connection', (socket) => {
  socket.emit('system:state', currentState);
  socket.emit('init:data', {
    transactions: transactions.slice(0, 50),
    logs: auditLogs.slice(0, 50),
    state: currentState
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server aktif di port ${PORT} | Base URL: ${PUBLIC_BASE_URL}`);
  addLog('SYSTEM', 'INFO', `Server backend berhasil berjalan pada port ${PORT}`);
});
