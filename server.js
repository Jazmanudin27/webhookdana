const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3005;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// System State
let currentState = {
  status: 'IDLE', // 'IDLE' | 'PAID' | 'FILLING' | 'EMERGENCY_STOP'
  activeOrder: null,
  esp32LastSeen: null,
  esp32Ip: null,
  esp32Status: 'OFFLINE',
  esp32CurrentSsid: null,
  totalWaterDispensedToday: 0,
  totalRevenueToday: 0,
  isMySql: false
};

async function refreshStats() {
  const stats = await db.getTodayStats();
  currentState.totalRevenueToday = stats.totalRevenueToday;
  currentState.totalWaterDispensedToday = stats.totalWaterDispensedToday;
  currentState.isMySql = db.isMySqlConnected();
}

// ESP32 Heartbeat Monitor
setInterval(() => {
  if (currentState.esp32LastSeen) {
    const elapsed = Date.now() - new Date(currentState.esp32LastSeen).getTime();
    const wasOnline = currentState.esp32Status === 'ONLINE';
    if (elapsed > 10000) {
      currentState.esp32Status = 'OFFLINE';
      if (wasOnline) {
        db.addLog('ESP32', 'WARNING', 'ESP32 Device Terputus (Heartbeat Timeout)');
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

app.post('/api/dana/create-order', async (req, res) => {
  try {
    const { packageId, customLiter, customerName } = req.body;
    
    let targetLiter = 19;
    let amount = 7000;
    let title = 'Isi Ulang 1 Galon (19L)';

    if (packageId) {
      const packages = await db.getPackages();
      const selected = packages.find(p => p.id === Number(packageId));
      if (selected) {
        targetLiter = selected.liters;
        amount = selected.price;
        title = `Isi Ulang ${selected.name}`;
      }
    } else if (customLiter > 0) {
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

    await db.saveTransaction(newOrder);

    const logItem = await db.addLog('DASHBOARD', 'INFO', `Order baru dibuat: ${orderId} (${title} - Rp ${amount.toLocaleString('id-ID')})`, newOrder);
    io.emit('log:new', logItem);
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

app.post('/api/dana/finish-notify', async (req, res) => {
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

    const logItem = await db.addLog('DANA_WEBHOOK', 'SUCCESS', `Webhook Finish-Notify diterima untuk Order: ${merchantTransId || 'Unknown'}`, rawBody);
    io.emit('log:new', logItem);

    let order = await db.findTransaction(merchantTransId);

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
      await db.saveTransaction(order);
    } else {
      await db.updateTransaction(merchantTransId, {
        status: 'PAID',
        paidAt: new Date().toISOString(),
        acquirementId: acquirementId
      });
      order.status = 'PAID';
      order.paidAt = new Date().toISOString();
    }

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

    const logSys = await db.addLog('SYSTEM', 'SUCCESS', `Pembayaran DANA Dikonfirmasi! Mengantrikan Dispenser ESP32: ${order.targetLiter} Liter`, currentState.activeOrder);
    io.emit('log:new', logSys);

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
          merchantTransId: order.merchantTransId || order.orderId,
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

app.post('/api/dana/simulate-pay', async (req, res) => {
  const { orderId } = req.body;
  let targetOrder = await db.findTransaction(orderId);

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
    await db.saveTransaction(targetOrder);
  }

  await db.updateTransaction(targetOrder.orderId, {
    status: 'PAID',
    paidAt: new Date().toISOString()
  });
  targetOrder.status = 'PAID';
  targetOrder.paidAt = new Date().toISOString();

  currentState.status = 'PAID';
  currentState.activeOrder = {
    orderId: targetOrder.orderId,
    targetLiter: targetOrder.targetLiter,
    amount: targetOrder.amount,
    title: targetOrder.title,
    customerName: targetOrder.customerName,
    paidAt: targetOrder.paidAt
  };

  const logItem = await db.addLog('DANA_WEBHOOK', 'SUCCESS', `[SIMULASI] Pembayaran Sukses DANA Sandbox untuk Order: ${targetOrder.orderId}`, targetOrder);
  io.emit('log:new', logItem);
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

app.get('/api/esp32/check-order', async (req, res) => {
  currentState.esp32LastSeen = new Date().toISOString();
  currentState.esp32Ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ESP32-Client';
  currentState.esp32Status = 'ONLINE';

  if (req.query.ssid) {
    currentState.esp32CurrentSsid = req.query.ssid;
  }

  // 1. Cek Instruksi Ganti WiFi
  const pendingWifi = await db.getSetting('pending_wifi_update');
  if (pendingWifi && pendingWifi.ssid) {
    const updatePayload = {
      status: 'UPDATE_WIFI',
      wifiSsid: pendingWifi.ssid,
      wifiPassword: pendingWifi.password || '',
      serverTime: Date.now()
    };
    await db.setSetting('pending_wifi_update', null);
    const logItem = await db.addLog('SYSTEM', 'INFO', `Instruksi ganti WiFi terkirim ke ESP32 -> SSID: ${updatePayload.wifiSsid}`);
    io.emit('log:new', logItem);
    return res.status(200).json(updatePayload);
  }

  // 2. Cek Order PAID
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

  // 3. Standby / IDLE
  return res.status(200).json({
    status: currentState.status === 'FILLING' ? 'FILLING' : 'IDLE',
    orderId: currentState.activeOrder ? currentState.activeOrder.orderId : null,
    targetLiter: currentState.activeOrder ? currentState.activeOrder.targetLiter : 0,
    serverTime: Date.now()
  });
});

app.post('/api/esp32/finish-fill', async (req, res) => {
  try {
    const { orderId, dispensedLiter, durationSeconds, status: fillStatus } = req.body;
    const actualLiter = Number(dispensedLiter) || 0;
    const isEmergency = fillStatus === 'EMERGENCY_STOP';

    await db.updateTransaction(orderId, {
      status: isEmergency ? 'STOPPED' : 'COMPLETED',
      dispensedLiter: actualLiter,
      durationSeconds: durationSeconds || 0,
      completedAt: new Date().toISOString()
    });

    const logMsg = isEmergency 
      ? `Pengisian dihentikan darurat: ${orderId} (${actualLiter}L)`
      : `Pengisian Air Selesai: ${orderId} (${actualLiter}L)`;
    const logItem = await db.addLog('ESP32', isEmergency ? 'WARNING' : 'SUCCESS', logMsg, req.body);
    io.emit('log:new', logItem);

    currentState.status = 'IDLE';
    currentState.activeOrder = null;
    await refreshStats();

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

// WiFi Settings Endpoint
app.post('/api/device/save-wifi', async (req, res) => {
  const { ssid, password } = req.body;
  if (!ssid) return res.status(400).json({ success: false, message: 'Nama WiFi (SSID) tidak boleh kosong!' });

  await db.setSetting('wifi_ssid', ssid);
  await db.setSetting('wifi_password', password || '');
  await db.setSetting('pending_wifi_update', { ssid, password: password || '', updatedAt: new Date().toISOString() });

  const logItem = await db.addLog('DASHBOARD', 'SUCCESS', `Pengaturan WiFi baru disimpan di Web: SSID "${ssid}". Perintah update dijadwalkan ke ESP32.`);
  io.emit('log:new', logItem);

  return res.json({
    success: true,
    message: `Pengaturan WiFi untuk "${ssid}" berhasil disimpan. ESP32 akan otomatis berganti ke WiFi baru pada polling berikutnya!`
  });
});

app.get('/api/device/settings', async (req, res) => {
  const wifiSsid = await db.getSetting('wifi_ssid', 'WiFi_Depot_Air');
  const wifiPass = await db.getSetting('wifi_password', '');
  const pendingUpdate = await db.getSetting('pending_wifi_update');

  return res.json({
    success: true,
    data: {
      wifiSsid,
      wifiPassword: wifiPass || '',
      hasPendingUpdate: Boolean(pendingUpdate),
      esp32CurrentSsid: currentState.esp32CurrentSsid,
      databaseType: db.isMySqlConnected() ? 'MySQL / MariaDB' : 'JSON Flat File (data/)'
    }
  });
});

// ==========================================
// 3. PAKET AIR (HARGA & LITERAN CRUD API)
// ==========================================

app.get('/api/packages', async (req, res) => {
  const packages = await db.getPackages();
  return res.json({ success: true, data: packages });
});

app.get('/api/admin/packages', async (req, res) => {
  const packages = await db.getAllPackagesAdmin();
  return res.json({ success: true, data: packages });
});

app.post('/api/admin/packages', async (req, res) => {
  try {
    const { id, name, liters, price, badge, isActive } = req.body;
    if (!name || !liters || !price) {
      return res.status(400).json({ success: false, message: 'Nama paket, liter, dan harga wajib diisi!' });
    }

    const saved = await db.savePackage({
      id: id ? Number(id) : undefined,
      name,
      liters: Number(liters),
      price: Number(price),
      badge: badge || '',
      isActive: isActive !== false
    });

    const logItem = await db.addLog('DASHBOARD', 'INFO', `Paket Air ${id ? 'diperbarui' : 'ditambahkan'}: ${name} (${liters}L - Rp ${Number(price).toLocaleString('id-ID')})`);
    io.emit('log:new', logItem);
    io.emit('packages:updated');

    return res.json({ success: true, message: 'Paket berhasil disimpan', data: saved });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

app.delete('/api/admin/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deletePackage(Number(id));
    const logItem = await db.addLog('DASHBOARD', 'WARNING', `Paket Air ID ${id} dihapus dari daftar`);
    io.emit('log:new', logItem);
    io.emit('packages:updated');
    return res.json({ success: true, message: 'Paket berhasil dihapus' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// 4. STATS & MONITORING API
// ==========================================

app.post('/api/depot/emergency-stop', async (req, res) => {
  const previousOrder = currentState.activeOrder;
  currentState.status = 'IDLE';
  currentState.activeOrder = null;

  if (previousOrder) {
    await db.updateTransaction(previousOrder.orderId, {
      status: 'STOPPED',
      completedAt: new Date().toISOString()
    });
  }

  const logItem = await db.addLog('DASHBOARD', 'WARNING', 'Emergency Stop diaktifkan manual dari Dashboard!');
  io.emit('log:new', logItem);
  io.emit('system:state', currentState);

  return res.json({ success: true, message: 'Emergency Stop dieksekusi' });
});

app.get('/api/status', async (req, res) => {
  await refreshStats();
  const configuredSsid = await db.getSetting('wifi_ssid', 'WiFi_Depot_Air');
  return res.json({
    success: true,
    data: {
      ...currentState,
      serverTime: new Date().toISOString(),
      publicBaseUrl: PUBLIC_BASE_URL,
      webhookEndpoint: `${PUBLIC_BASE_URL}/api/dana/finish-notify`,
      esp32CheckEndpoint: `${PUBLIC_BASE_URL}/api/esp32/check-order`,
      esp32FinishEndpoint: `${PUBLIC_BASE_URL}/api/esp32/finish-fill`,
      configuredWifiSsid: configuredSsid,
      databaseType: db.isMySqlConnected() ? 'MySQL (Live Connected)' : 'JSON Database'
    }
  });
});

app.get('/api/transactions', async (req, res) => {
  const tx = await db.getTransactions(100);
  return res.json({ success: true, total: tx.length, data: tx });
});

app.get('/api/logs', async (req, res) => {
  const logs = await db.getLogs(100);
  return res.json({ success: true, total: logs.length, data: logs });
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

io.on('connection', async (socket) => {
  await refreshStats();
  socket.emit('system:state', currentState);
  const tx = await db.getTransactions(50);
  const logs = await db.getLogs(50);
  socket.emit('init:data', {
    transactions: tx,
    logs: logs,
    state: currentState
  });
});

// Boot Server
async function start() {
  await db.initDB();
  await refreshStats();
  server.listen(PORT, () => {
    console.log(`🚀 Server aktif di port ${PORT} | Base URL: ${PUBLIC_BASE_URL}`);
    console.log(`🗄️ Database: ${db.isMySqlConnected() ? 'MySQL Connected' : 'JSON Storage'}`);
  });
}

start();
