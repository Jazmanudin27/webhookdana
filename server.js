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

const PORT = process.env.PORT || 3000;
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

// Load stored data or initialize
let transactions = [];
let auditLogs = [];

try {
  if (fs.existsSync(TRANSACTIONS_FILE)) {
    transactions = JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8'));
  }
} catch (e) {
  console.error('Error reading transactions.json:', e.message);
  transactions = [];
}

try {
  if (fs.existsSync(LOGS_FILE)) {
    auditLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
  }
} catch (e) {
  console.error('Error reading logs.json:', e.message);
  auditLogs = [];
}

function saveTransactions() {
  try {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions.slice(-200), null, 2));
  } catch (e) {
    console.error('Failed to save transactions:', e.message);
  }
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

/**
 * Endpoint: /api/dana/create-order
 * Digunakan oleh Web Dashboard / User Kiosk untuk membuat order transaksi isi ulang
 */
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
      // Rp 368 per liter (~Rp 7.000 / 19L)
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
      status: 'PENDING', // 'PENDING' -> 'PAID' -> 'FILLING' -> 'COMPLETED'
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
    console.error('Error creating order:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Endpoint: /api/dana/finish-notify
 * Webhook resmi dari DANA Sandbox untuk notifikasi pembayaran sukses (Finish Notify)
 */
app.post('/api/dana/finish-notify', (req, res) => {
  try {
    const rawBody = req.body;
    console.log('--- DANA FINISH-NOTIFY WEBHOOK RECEIVED ---');
    console.log(JSON.stringify(rawBody, null, 2));

    // Ekstraksi data baik dari format standar DANA OpenAPI maupun format simulasi sederhana
    let merchantTransId = null;
    let acquirementId = null;
    let amountVal = null;
    let resultStatus = 'SUCCESS';

    if (rawBody.response && rawBody.response.body) {
      // Standar format DANA Open API
      const b = rawBody.response.body;
      merchantTransId = b.merchantTransId || (b.orderInfo && b.orderInfo.merchantTransId);
      acquirementId = b.acquirementId;
      amountVal = b.amount ? Number(b.amount.value) : null;
      resultStatus = b.resultInfo ? b.resultInfo.resultStatus : 'SUCCESS';
    } else {
      // Fallback format payload langsung
      merchantTransId = rawBody.merchantTransId || rawBody.orderId || rawBody.order_id;
      acquirementId = rawBody.acquirementId || rawBody.transaction_id || 'DANA-ACQ-' + Date.now();
      amountVal = rawBody.amount || rawBody.totalAmount;
      resultStatus = rawBody.resultStatus || rawBody.status || 'SUCCESS';
    }

    // Log payload webhook yang masuk
    addLog('DANA_WEBHOOK', 'SUCCESS', `Webhook Finish-Notify diterima untuk Order: ${merchantTransId || 'Unknown'}`, rawBody);

    // Cari transaksi di database
    let order = transactions.find(t => t.orderId === merchantTransId || t.merchantTransId === merchantTransId);

    if (!order) {
      // Jika order belum terdaftar (misal dipicu langsung via webhook tester), buat otomatis
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

    // Update Status Depot & Queue ke ESP32
    currentState.status = 'PAID';
    currentState.activeOrder = {
      orderId: order.orderId,
      targetLiter: order.targetLiter,
      amount: order.amount,
      title: order.title,
      customerName: order.customerName,
      paidAt: order.paidAt
    };

    // Broadcast ke frontend / dashboard real-time
    io.emit('order:paid', order);
    io.emit('system:state', currentState);

    addLog('SYSTEM', 'SUCCESS', `Pembayaran DANA Dikonfirmasi! Mengantrikan Dispenser ESP32: ${order.targetLiter} Liter`, currentState.activeOrder);

    // DANA Open API Standar Response
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
    console.error('Webhook error:', error);
    addLog('DANA_WEBHOOK', 'ERROR', 'Error saat memproses webhook DANA: ' + error.message, error.stack);
    return res.status(500).json({
      response: {
        body: {
          resultInfo: {
            resultStatus: 'F',
            resultCode: 'FAILED',
            resultMsg: error.message
          }
        }
      }
    });
  }
});

/**
 * Endpoint Simulasi Pembayaran Cepat (Untuk Test / Demo Sandbox)
 */
app.post('/api/dana/simulate-pay', (req, res) => {
  const { orderId } = req.body;
  let targetOrder = transactions.find(t => t.orderId === orderId);

  if (!targetOrder) {
    // Buat order default 1 galon jika tidak ada ID
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

  // Siapkan payload seolah-olah dikirim oleh DANA Gateway
  const danaWebhookPayload = {
    response: {
      head: {
        version: '2.0',
        function: 'dana.acquirement.order.finishNotify',
        clientId: process.env.DANA_CLIENT_ID || '2021000000000001',
        reqTime: new Date().toISOString()
      },
      body: {
        resultInfo: {
          resultStatus: 'S',
          resultCode: 'SUCCESS',
          resultMsg: 'Transaction successful in Sandbox'
        },
        merchantTransId: targetOrder.orderId,
        acquirementId: 'DANA-SIM-ACQ-' + Date.now(),
        orderTitle: targetOrder.title,
        amount: {
          value: `${targetOrder.amount}.00`,
          currency: 'IDR'
        },
        payTime: new Date().toISOString()
      }
    }
  };

  // Jalankan logika webhook finish-notify
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

  addLog('DANA_WEBHOOK', 'SUCCESS', `[SIMULASI] Pembayaran Sukses DANA Sandbox untuk Order: ${targetOrder.orderId}`, danaWebhookPayload);

  io.emit('order:paid', targetOrder);
  io.emit('system:state', currentState);

  return res.json({
    success: true,
    message: 'Simulasi pembayaran DANA Sandbox sukses!',
    order: targetOrder,
    simulatedWebhook: danaWebhookPayload
  });
});

// ==========================================
// 2. ESP32 FIRMWARE POLLING & CONTROL API
// ==========================================

/**
 * Endpoint: /api/esp32/check-order
 * ESP32 memanggil endpoint ini setiap 2 detik (HTTP GET).
 * Mengembalikan status "PAID" jika ada transaksi yang perlu diisi, atau "IDLE".
 */
app.get('/api/esp32/check-order', (req, res) => {
  // Catat heartbeat ESP32
  currentState.esp32LastSeen = new Date().toISOString();
  currentState.esp32Ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ESP32-Client';
  currentState.esp32Status = 'ONLINE';

  // Jika ada order berstatus PAID yang siap diisi
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

  // Jika sedang mengisi atau idle
  return res.status(200).json({
    status: currentState.status === 'FILLING' ? 'FILLING' : 'IDLE',
    orderId: currentState.activeOrder ? currentState.activeOrder.orderId : null,
    targetLiter: currentState.activeOrder ? currentState.activeOrder.targetLiter : 0,
    serverTime: Date.now()
  });
});

/**
 * Endpoint: /api/esp32/finish-fill
 * Dipanggil oleh ESP32 setelah flow sensor mencapai target liter atau terjadi emergency stop.
 */
app.post('/api/esp32/finish-fill', (req, res) => {
  try {
    const { orderId, dispensedLiter, durationSeconds, status: fillStatus } = req.body;
    console.log('--- ESP32 FINISH-FILL RECEIVED ---', req.body);

    const actualLiter = Number(dispensedLiter) || 0;
    const isEmergency = fillStatus === 'EMERGENCY_STOP';

    // Cari order
    const order = transactions.find(t => t.orderId === orderId);
    if (order) {
      order.status = isEmergency ? 'STOPPED' : 'COMPLETED';
      order.dispensedLiter = actualLiter;
      order.durationSeconds = durationSeconds || 0;
      order.completedAt = new Date().toISOString();
      saveTransactions();
    }

    // Catat log
    if (isEmergency) {
      addLog('ESP32', 'WARNING', `PENGISIAN DIHENTIKAN DARURAT (Emergency Button)! Order: ${orderId}, Terisi: ${actualLiter}L`, req.body);
    } else {
      addLog('ESP32', 'SUCCESS', `Pengisian Air Selesai! Order: ${orderId}, Total Terisi: ${actualLiter}L (${durationSeconds || 0}s)`, req.body);
    }

    // Reset status depot kembali ke IDLE
    currentState.status = 'IDLE';
    currentState.activeOrder = null;
    updateTodayStats();

    // Broadcast ke frontend
    io.emit('order:completed', {
      orderId,
      dispensedLiter: actualLiter,
      status: isEmergency ? 'STOPPED' : 'COMPLETED',
      completedAt: new Date().toISOString()
    });
    io.emit('system:state', currentState);

    return res.status(200).json({
      success: true,
      message: isEmergency ? 'Emergency stop acknowledged. System reset to IDLE.' : 'Refill completed successfully. System reset to IDLE.',
      status: 'IDLE'
    });
  } catch (error) {
    console.error('Error in finish-fill:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Endpoint Telemetri Live (Optional dipanggil ESP32 saat proses mengisi untuk live gauge di web)
 */
app.post('/api/esp32/telemetry', (req, res) => {
  const { currentLiter, flowRate, pulses, orderId } = req.body;
  if (currentState.status === 'PAID') {
    currentState.status = 'FILLING';
  }
  
  io.emit('esp32:telemetry', {
    orderId: orderId || (currentState.activeOrder ? currentState.activeOrder.orderId : null),
    currentLiter: Number(currentLiter) || 0,
    flowRate: Number(flowRate) || 0,
    pulses: Number(pulses) || 0,
    timestamp: Date.now()
  });

  return res.json({ ok: true });
});

/**
 * Endpoint Emergency Stop dari Web Dashboard
 */
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

  return res.json({
    success: true,
    message: 'Emergency Stop berhasil dieksekusi, sistem direset ke IDLE'
  });
});

// ==========================================
// 3. DASHBOARD MONITORING & STATS API
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
      esp32FinishEndpoint: `${PUBLIC_BASE_URL}/api/esp32/finish-fill`
    }
  });
});

app.get('/api/transactions', (req, res) => {
  return res.json({
    success: true,
    total: transactions.length,
    data: transactions
  });
});

app.get('/api/logs', (req, res) => {
  return res.json({
    success: true,
    total: auditLogs.length,
    data: auditLogs
  });
});

// Serve frontend static files if built
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

// WebSocket Connection Handler
io.on('connection', (socket) => {
  socket.emit('system:state', currentState);
  socket.emit('init:data', {
    transactions: transactions.slice(0, 50),
    logs: auditLogs.slice(0, 50),
    state: currentState
  });

  socket.on('request:refresh', () => {
    updateTodayStats();
    socket.emit('system:state', currentState);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 DEPOT AIR ISI ULANG - WEBHOOK DANA SANDBOX + ESP32`);
  console.log(`====================================================`);
  console.log(`📡 Local Server       : http://localhost:${PORT}`);
  console.log(`🌐 Public Base URL    : ${PUBLIC_BASE_URL}`);
  console.log(`🔗 Webhook DANA       : ${PUBLIC_BASE_URL}/api/dana/finish-notify`);
  console.log(`🤖 ESP32 Check Order  : ${PUBLIC_BASE_URL}/api/esp32/check-order`);
  console.log(`💧 ESP32 Finish Fill  : ${PUBLIC_BASE_URL}/api/esp32/finish-fill`);
  console.log(`====================================================`);
  addLog('SYSTEM', 'INFO', `Server backend berhasil berjalan pada port ${PORT}`);
});
