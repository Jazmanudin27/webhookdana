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

const crypto = require('crypto');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ==========================================
// SESSION & AUTHENTICATION MIDDLEWARE (PERSISTENT)
// ==========================================

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
  const token = authHeader ? (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim()) : null;
  
  if (token) {
    try {
      const session = await db.getSession(token);
      if (session && session.expiresAt > Date.now()) {
        req.user = session.user;
        req.token = token;
      } else {
        req.user = null;
        req.token = null;
      }
    } catch (err) {
      req.user = null;
      req.token = null;
    }
  } else {
    req.user = null;
    req.token = null;
  }
  next();
}

// ==========================================
// ESP32 HARDWARE API KEY AUTHENTICATION
// ==========================================
async function authenticateEsp32(req, res, next) {
  const deviceId = (req.query.deviceId || req.body.deviceId || req.headers['x-device-id'] || 'DEPOT-001').toUpperCase().trim();
  const apiKey = req.headers['x-api-key'] || req.headers['x-device-key'] || req.query.apiKey || req.body.apiKey;
  const masterKey = process.env.ESP32_MASTER_KEY || 'DEPOT_IOT_KEY_2026';

  // 1. Master Key selalu diizinkan
  if (apiKey && apiKey === masterKey) {
    req.deviceId = deviceId;
    return next();
  }

  // 2. Cek API Key spesifik mesin di database
  try {
    const machine = await db.getMachine(deviceId);
    if (machine && machine.apiKey) {
      if (apiKey === machine.apiKey) {
        req.deviceId = deviceId;
        return next();
      }
      return res.status(401).json({ success: false, message: `Akses ditolak: API Key untuk mesin [${deviceId}] tidak valid!` });
    }
  } catch (err) {}

  // 3. Fallback permisif untuk mesin legacy / setup awal
  req.deviceId = deviceId;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Super Admin yang berhak' });
  }
  next();
}

app.use(authenticateToken);

// ==========================================
// MULTI-MACHINE (FLEET) IN-MEMORY STATE
// ==========================================
const machinesState = {};

function getOrCreateMachineState(machineId = 'DEPOT-001') {
  const mId = (machineId || 'DEPOT-001').toUpperCase().trim();
  if (!machinesState[mId]) {
    machinesState[mId] = {
      machineId: mId,
      status: 'IDLE', // 'IDLE' | 'PAID' | 'FILLING' | 'PAUSED' | 'EMERGENCY_STOP'
      activeOrder: null,
      pendingCommand: null, // 'START' | 'PAUSE' | 'STOP'
      esp32LastSeen: null,
      esp32Ip: null,
      esp32Status: 'OFFLINE',
      esp32CurrentSsid: null,
      currentLiter: 0,
      flowRate: 0,
      totalWaterDispensedToday: 0,
      totalRevenueToday: 0,
      isMySql: false
    };
  }
  return machinesState[mId];
}

// Default device (DEPOT-001) for backwards compatibility
const currentState = getOrCreateMachineState('DEPOT-001');

async function refreshStats() {
  const stats = await db.getTodayStats();
  currentState.totalRevenueToday = stats.totalRevenueToday;
  currentState.totalWaterDispensedToday = stats.totalWaterDispensedToday;
  currentState.isMySql = db.isMySqlConnected();
}

// Multi-Device ESP32 Heartbeat Monitor
setInterval(async () => {
  const now = Date.now();
  for (const mId of Object.keys(machinesState)) {
    const m = machinesState[mId];
    if (m.esp32LastSeen) {
      const elapsed = now - new Date(m.esp32LastSeen).getTime();
      const wasOnline = m.esp32Status === 'ONLINE';
      if (elapsed > 45000) {
        m.esp32Status = 'OFFLINE';
        if (wasOnline) {
          db.addLog('ESP32', 'WARNING', `ESP32 Mesin [${mId}] Terputus (Heartbeat Timeout)`);
          db.updateMachineStatus(mId, { status: 'OFFLINE' });
          io.emit('machine:updated', m);
          if (mId === 'DEPOT-001') {
            io.emit('system:state', m);
          }
        }
      }
    }
  }
}, 3000);

// ==========================================
// 1. DANA SANDBOX WEBHOOK & ORDER ENDPOINTS
// ==========================================

// ==========================================
// 1. DANA SANDBOX WEBHOOK & ORDER ENDPOINTS
// ==========================================

app.post('/api/dana/create-order', async (req, res) => {
  try {
    const { packageId, customLiter, customerName, deviceId } = req.body;
    const targetDeviceId = (deviceId || 'DEPOT-001').toUpperCase().trim();
    
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
      deviceId: targetDeviceId,
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
      checkoutUrl: `${PUBLIC_BASE_URL}/checkout/${orderId}?machine=${targetDeviceId}`
    };

    await db.saveTransaction(newOrder);

    const logItem = await db.addLog('DASHBOARD', 'INFO', `Order baru dibuat [Cabang ${targetDeviceId}]: ${orderId} (${title} - Rp ${amount.toLocaleString('id-ID')})`, newOrder);
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
        deviceId: 'DEPOT-001',
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

    const targetDeviceId = (order.deviceId || 'DEPOT-001').toUpperCase().trim();
    const machineState = getOrCreateMachineState(targetDeviceId);

    machineState.status = 'PAID';
    machineState.activeOrder = {
      orderId: order.orderId,
      deviceId: targetDeviceId,
      targetLiter: order.targetLiter,
      amount: order.amount,
      title: order.title,
      customerName: order.customerName,
      paidAt: order.paidAt
    };

    io.emit('order:paid', order);
    io.emit('machine:updated', machineState);
    if (targetDeviceId === 'DEPOT-001') {
      io.emit('system:state', machineState);
    }

    const logSys = await db.addLog('SYSTEM', 'SUCCESS', `Pembayaran DANA Dikonfirmasi! Mengantrikan Dispenser [Cabang ${targetDeviceId}]: ${order.targetLiter} Liter`, machineState.activeOrder);
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
  const { orderId, deviceId } = req.body;
  let targetOrder = await db.findTransaction(orderId);
  const targetDeviceId = (deviceId || (targetOrder && targetOrder.deviceId) || 'DEPOT-001').toUpperCase().trim();

  if (!targetOrder) {
    const newOrderId = 'DANA-SIM-' + Date.now();
    targetOrder = {
      orderId: newOrderId,
      merchantTransId: newOrderId,
      deviceId: targetDeviceId,
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

  const machineState = getOrCreateMachineState(targetDeviceId);
  machineState.status = 'PAID';
  machineState.activeOrder = {
    orderId: targetOrder.orderId,
    deviceId: targetDeviceId,
    targetLiter: targetOrder.targetLiter,
    amount: targetOrder.amount,
    title: targetOrder.title,
    customerName: targetOrder.customerName,
    paidAt: targetOrder.paidAt
  };

  const logItem = await db.addLog('DANA_WEBHOOK', 'SUCCESS', `[SIMULASI] Pembayaran Sukses DANA Sandbox [Cabang ${targetDeviceId}] untuk Order: ${targetOrder.orderId}`, targetOrder);
  io.emit('log:new', logItem);
  io.emit('order:paid', targetOrder);
  io.emit('machine:updated', machineState);
  if (targetDeviceId === 'DEPOT-001') {
    io.emit('system:state', machineState);
  }

  return res.json({
    success: true,
    message: `Simulasi pembayaran DANA Sandbox sukses untuk Cabang ${targetDeviceId}!`,
    order: targetOrder
  });
});

// ==========================================
// 2. ESP32 POLLING & WIFI SETTINGS API (SECURED)
// ==========================================

app.get('/api/esp32/check-order', authenticateEsp32, async (req, res) => {
  const deviceId = req.deviceId || (req.query.deviceId || req.query.machineId || 'DEPOT-001').toUpperCase().trim();
  const machineState = getOrCreateMachineState(deviceId);

  machineState.esp32LastSeen = new Date().toISOString();
  machineState.esp32Ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ESP32-Client';
  machineState.esp32Status = 'ONLINE';

  if (req.query.ssid) {
    machineState.esp32CurrentSsid = req.query.ssid;
  }

  // Update DB machine status
  db.updateMachineStatus(deviceId, {
    status: machineState.status === 'IDLE' ? 'ONLINE' : machineState.status,
    ip: machineState.esp32Ip,
    ssid: machineState.esp32CurrentSsid,
    lastSeen: machineState.esp32LastSeen
  });

  // Terima telemetry & sync status dari ESP32 jika dikirim
  if (req.query.currentLiter !== undefined) {
    const curLiter = parseFloat(req.query.currentLiter) || 0;
    const curFlow = parseFloat(req.query.flowRate) || 0;
    const devState = req.query.state; // 'FILLING' | 'PAUSED' | 'WAITING' | 'IDLE'

    machineState.currentLiter = curLiter;
    machineState.flowRate = curFlow;

    if (devState === 'FILLING') {
      if (machineState.pendingCommand === 'START' || machineState.pendingCommand === 'RESUME') {
        machineState.pendingCommand = null;
      }
      if (machineState.status !== 'FILLING') {
        machineState.status = 'FILLING';
        io.emit('machine:updated', machineState);
        if (deviceId === 'DEPOT-001') io.emit('system:state', machineState);
      }
    } else if (devState === 'PAUSED') {
      if (machineState.pendingCommand === 'PAUSE') {
        machineState.pendingCommand = null;
      }
      if (machineState.status !== 'PAUSED') {
        machineState.status = 'PAUSED';
        io.emit('machine:updated', machineState);
        if (deviceId === 'DEPOT-001') io.emit('system:state', machineState);
      }
    } else if (devState === 'WAITING' && machineState.status !== 'PAID') {
      machineState.status = 'PAID';
      io.emit('machine:updated', machineState);
      if (deviceId === 'DEPOT-001') io.emit('system:state', machineState);
    }

    if (req.query.pauseRemaining !== undefined) {
      machineState.pauseRemaining = Number(req.query.pauseRemaining) || 0;
    }

    io.emit('esp32:telemetry', {
      deviceId,
      orderId: machineState.activeOrder ? machineState.activeOrder.orderId : (req.query.orderId || null),
      currentLiter: curLiter,
      flowRate: curFlow,
      pauseRemaining: machineState.pauseRemaining || 0,
      timestamp: Date.now()
    });
  }

  // 1. Cek Instruksi Ganti WiFi (Targeted per device jika ada)
  const pendingWifi = await db.getSetting(`pending_wifi_${deviceId}`) || await db.getSetting('pending_wifi_update');
  if (pendingWifi && pendingWifi.ssid) {
    const updatePayload = {
      status: 'UPDATE_WIFI',
      wifiSsid: pendingWifi.ssid,
      wifiPassword: pendingWifi.password || '',
      serverTime: Date.now()
    };
    await db.setSetting(`pending_wifi_${deviceId}`, null);
    if (!await db.getSetting(`pending_wifi_${deviceId}`)) {
      await db.setSetting('pending_wifi_update', null);
    }
    const logItem = await db.addLog('SYSTEM', 'INFO', `Instruksi ganti WiFi terkirim ke ESP32 [Cabang ${deviceId}] -> SSID: ${updatePayload.wifiSsid}`);
    io.emit('log:new', logItem);
    return res.status(200).json(updatePayload);
  }

  // 1.5. Cek Perintah Kucur Air dari Web (START / PAUSE / RESUME / STOP)
  if (machineState.pendingCommand) {
    const cmd = machineState.pendingCommand;
    machineState.pendingCommand = null;
    return res.status(200).json({
      status: cmd,
      deviceId,
      orderId: machineState.activeOrder ? machineState.activeOrder.orderId : null,
      targetLiter: machineState.activeOrder ? machineState.activeOrder.targetLiter : 0,
      serverTime: Date.now()
    });
  }

  // 2. Cek Order PAID / PAUSED
  if ((machineState.status === 'PAID' || machineState.status === 'PAUSED') && machineState.activeOrder) {
    return res.status(200).json({
      status: machineState.status,
      deviceId,
      orderId: machineState.activeOrder.orderId,
      targetLiter: machineState.activeOrder.targetLiter,
      price: machineState.activeOrder.amount,
      productName: machineState.activeOrder.title,
      serverTime: Date.now()
    });
  }

  // 3. Standby / IDLE / FILLING / PAUSED
  let returnStatus = 'IDLE';
  if (machineState.status === 'FILLING') returnStatus = 'FILLING';
  else if (machineState.status === 'PAUSED') returnStatus = 'PAUSED';

  return res.status(200).json({
    status: returnStatus,
    deviceId,
    orderId: machineState.activeOrder ? machineState.activeOrder.orderId : null,
    targetLiter: machineState.activeOrder ? machineState.activeOrder.targetLiter : 0,
    serverTime: Date.now()
  });
});

// Endpoint Kontrol Tombol Kucur Air dari Web (Multi-Cabang)
app.post('/api/dispenser/action', (req, res) => {
  const { action, deviceId } = req.body; // 'TOGGLE' | 'START' | 'PAUSE' | 'RESUME' | 'STOP'
  const targetDeviceId = (deviceId || 'DEPOT-001').toUpperCase().trim();
  const machineState = getOrCreateMachineState(targetDeviceId);
  
  if (action === 'TOGGLE') {
    if (machineState.status === 'PAID' || machineState.status === 'PAUSED') {
      machineState.status = 'FILLING';
      machineState.pendingCommand = 'START';
    } else if (machineState.status === 'FILLING') {
      machineState.status = 'PAUSED';
      machineState.pendingCommand = 'PAUSE';
    }
  } else if (action === 'START' || action === 'RESUME') {
    machineState.status = 'FILLING';
    machineState.pendingCommand = 'START';
  } else if (action === 'PAUSE') {
    machineState.status = 'PAUSED';
    machineState.pendingCommand = 'PAUSE';
  } else if (action === 'STOP' || action === 'FINISH_EARLY') {
    const prevOrder = machineState.activeOrder;
    machineState.status = 'IDLE';
    machineState.pendingCommand = 'STOP';
    if (prevOrder) {
      const dispensed = machineState.currentLiter || 0;
      db.updateTransaction(prevOrder.orderId, {
        status: 'COMPLETED',
        dispensedLiter: dispensed,
        completedAt: new Date().toISOString()
      });
      db.incrementMachineUsage(targetDeviceId, dispensed, prevOrder.amount || 0);
      io.emit('order:completed', {
        orderId: prevOrder.orderId,
        deviceId: targetDeviceId,
        dispensedLiter: dispensed,
        status: 'COMPLETED',
        completedAt: new Date().toISOString()
      });
      machineState.activeOrder = null;
      machineState.currentLiter = 0;
      machineState.flowRate = 0;
      machineState.pauseRemaining = 0;
    }
  }

  io.emit('machine:updated', machineState);
  if (targetDeviceId === 'DEPOT-001') {
    io.emit('system:state', machineState);
  }
  return res.json({ success: true, deviceId: targetDeviceId, status: machineState.status });
});

app.post('/api/depot/emergency-stop', (req, res) => {
  const { deviceId } = req.body || {};
  const targetDeviceId = (deviceId || req.query.deviceId || 'DEPOT-001').toUpperCase().trim();
  const machineState = getOrCreateMachineState(targetDeviceId);
  
  machineState.status = 'IDLE';
  machineState.activeOrder = null;
  machineState.pendingCommand = 'STOP';

  io.emit('machine:updated', machineState);
  if (targetDeviceId === 'DEPOT-001') {
    io.emit('system:state', machineState);
  }
  return res.json({ success: true, deviceId: targetDeviceId, status: 'IDLE' });
});

app.post('/api/esp32/finish-fill', authenticateEsp32, async (req, res) => {
  try {
    const { orderId, dispensedLiter, durationSeconds, status: fillStatus, deviceId } = req.body;
    const actualLiter = Number(dispensedLiter) || 0;
    const isEmergency = fillStatus === 'EMERGENCY_STOP' || fillStatus === 'STOPPED';
    const isIncomplete = fillStatus === 'INCOMPLETE';
    const targetDeviceId = (deviceId || req.query.deviceId || 'DEPOT-001').toUpperCase().trim();
    const machineState = getOrCreateMachineState(targetDeviceId);

    // Refresh Heartbeat agar ESP32 tetap ONLINE saat kirim laporan selesai
    machineState.esp32LastSeen = new Date().toISOString();
    machineState.esp32Ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || machineState.esp32Ip || 'ESP32-Client';
    machineState.esp32Status = 'ONLINE';
    db.updateMachineStatus(targetDeviceId, {
      status: 'ONLINE',
      ip: machineState.esp32Ip,
      lastSeen: machineState.esp32LastSeen
    });

    let finalStatus = 'COMPLETED';
    if (isEmergency) finalStatus = 'STOPPED';
    else if (isIncomplete) finalStatus = 'INCOMPLETE';

    await db.updateTransaction(orderId, {
      status: finalStatus,
      dispensedLiter: actualLiter,
      durationSeconds: durationSeconds || 0,
      completedAt: new Date().toISOString()
    });

    const tx = await db.findTransaction(orderId);
    await db.incrementMachineUsage(targetDeviceId, actualLiter, tx ? tx.amount : 0);

    let logLevel = 'SUCCESS';
    let logMsg = `Pengisian Air Selesai [Cabang ${targetDeviceId}]: ${orderId} (${actualLiter}L)`;

    if (isEmergency) {
      logLevel = 'WARNING';
      logMsg = `Pengisian dihentikan darurat [Cabang ${targetDeviceId}]: ${orderId} (${actualLiter}L)`;
    } else if (isIncomplete) {
      logLevel = 'WARNING';
      const targetL = tx ? (tx.targetLiter || '?') : '?';
      logMsg = `Pengisian Kurang / Terhenti [Cabang ${targetDeviceId}]: ${orderId} (Terisi ${actualLiter}L dari ${targetL}L)`;
    }

    const logItem = await db.addLog('ESP32', logLevel, logMsg, req.body);
    io.emit('log:new', logItem);

    machineState.status = 'IDLE';
    machineState.activeOrder = null;
    machineState.currentLiter = 0;
    machineState.flowRate = 0;
    await refreshStats();

    io.emit('order:completed', {
      orderId,
      deviceId: targetDeviceId,
      dispensedLiter: actualLiter,
      status: finalStatus,
      completedAt: new Date().toISOString()
    });
    io.emit('machine:updated', machineState);
    if (targetDeviceId === 'DEPOT-001') {
      io.emit('system:state', machineState);
    }

    return res.status(200).json({ success: true, deviceId: targetDeviceId, status: 'IDLE' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/esp32/telemetry', (req, res) => {
  const { currentLiter, flowRate, pulses, orderId, isFilling, isWaitingButton, isPaused, state, deviceId } = req.body;
  const targetDeviceId = (deviceId || req.query.deviceId || 'DEPOT-001').toUpperCase().trim();
  const machineState = getOrCreateMachineState(targetDeviceId);
  
  // Refresh Heartbeat ESP32 agar status selalu ONLINE
  machineState.esp32LastSeen = new Date().toISOString();
  machineState.esp32Status = 'ONLINE';
  machineState.currentLiter = Number(currentLiter) || 0;
  machineState.flowRate = Number(flowRate) || 0;

  if (state === 'PAUSED' || isPaused) {
    if (machineState.status !== 'PAUSED') {
      machineState.status = 'PAUSED';
      io.emit('machine:updated', machineState);
      if (targetDeviceId === 'DEPOT-001') io.emit('system:state', machineState);
    }
  } else if (state === 'FILLING' || isFilling) {
    if (machineState.status !== 'FILLING') {
      machineState.status = 'FILLING';
      io.emit('machine:updated', machineState);
      if (targetDeviceId === 'DEPOT-001') io.emit('system:state', machineState);
    }
  } else if (state === 'WAITING' || isWaitingButton) {
    if (machineState.status !== 'PAID') {
      machineState.status = 'PAID';
      io.emit('machine:updated', machineState);
      if (targetDeviceId === 'DEPOT-001') io.emit('system:state', machineState);
    }
  }
  
  io.emit('esp32:telemetry', {
    deviceId: targetDeviceId,
    orderId: orderId || (machineState.activeOrder ? machineState.activeOrder.orderId : null),
    currentLiter: Number(currentLiter) || 0,
    flowRate: Number(flowRate) || 0,
    pulses: Number(pulses) || 0,
    timestamp: Date.now()
  });

  return res.json({ ok: true, deviceId: targetDeviceId, status: machineState.status });
});

// ==========================================
// 3. MULTI-CABANG FLEET MANAGEMENT API
// ==========================================

app.get('/api/machines', async (req, res) => {
  try {
    let filterId = null;
    if (req.user && req.user.role === 'CLIENT') {
      filterId = req.user.assignedMachineId || 'DEPOT-001';
    } else if (req.query.deviceId) {
      filterId = req.query.deviceId;
    }

    const dbMachines = await db.getMachines(filterId);
    const result = dbMachines.map(m => {
      const live = getOrCreateMachineState(m.id);
      return {
        ...m,
        status: live.esp32Status === 'ONLINE' ? live.status : 'OFFLINE',
        esp32Status: live.esp32Status,
        esp32LastSeen: live.esp32LastSeen || m.lastSeen,
        esp32Ip: live.esp32Ip || m.ip,
        esp32CurrentSsid: live.esp32CurrentSsid || m.ssid,
        activeOrder: live.activeOrder,
        currentLiter: live.currentLiter,
        flowRate: live.flowRate
      };
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/machines', requireAdmin, async (req, res) => {
  try {
    const { id, name, location, filterLimitLiters } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, message: 'ID Mesin dan Nama Cabang wajib diisi!' });
    }
    const cleanId = id.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '');
    const saved = await db.saveMachine({
      id: cleanId,
      name,
      location: location || '',
      filterLimitLiters: Number(filterLimitLiters) || 10000
    });
    getOrCreateMachineState(cleanId);
    
    const logItem = await db.addLog('DASHBOARD', 'SUCCESS', `Cabang Baru Terdaftar: ${cleanId} - ${name} (${location || 'Pusat'})`);
    io.emit('log:new', logItem);
    io.emit('machines:updated');

    return res.json({ success: true, data: saved });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/machines/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteMachine(id);
    delete machinesState[id];

    const logItem = await db.addLog('DASHBOARD', 'WARNING', `Cabang ${id} dihapus dari armada depot`);
    io.emit('log:new', logItem);
    io.emit('machines:updated');

    return res.json({ success: true, message: `Mesin ${id} berhasil dihapus` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// AUTHENTICATION & MULTI-TENANT RBAC API
// ==========================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi!' });
    }
    const user = await db.validateUser(username, password);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Username atau password salah!' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 3600 * 1000;
    await db.saveSession(token, user, expiresAt);

    const logItem = await db.addLog('AUTH', 'SUCCESS', `User [${user.username}] login sukses (Role: ${user.role}${user.assignedMachineId ? ' - ' + user.assignedMachineId : ''})`);
    io.emit('log:new', logItem);

    return res.json({
      success: true,
      token,
      user
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Belum login' });
  }
  return res.json({ success: true, user: req.user });
});

app.post('/api/auth/logout', async (req, res) => {
  if (req.token) {
    await db.deleteSession(req.token);
  }
  return res.json({ success: true, message: 'Logout berhasil' });
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.getUsers();
    return res.json({ success: true, data: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { id, username, password, name, role, assignedMachineId, phone } = req.body;
    if (!username || !name) {
      return res.status(400).json({ success: false, message: 'Username dan Nama wajib diisi!' });
    }
    const saved = await db.saveUser({
      id: id ? Number(id) : undefined,
      username: username.toLowerCase().trim(),
      password,
      name,
      role: role || 'CLIENT',
      assignedMachineId: assignedMachineId || null,
      phone: phone || ''
    });

    const logItem = await db.addLog('ADMIN', 'SUCCESS', `Akun Pengguna Disimpan: ${saved.username} (Role: ${saved.role})`);
    io.emit('log:new', logItem);

    return res.json({ success: true, data: saved });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteUser(Number(id));

    const logItem = await db.addLog('ADMIN', 'WARNING', `Pengguna ID #${id} dihapus oleh Admin`);
    io.emit('log:new', logItem);

    return res.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/machines/:id/reset-filter', async (req, res) => {
  try {
    const { id } = req.params;
    await db.resetMachineFilter(id);

    const logItem = await db.addLog('MAINTENANCE', 'SUCCESS', `Filter Air pada Cabang [${id}] telah di-reset ke 0 Liter (Selesai Ganti Filter Baru)`);
    io.emit('log:new', logItem);
    io.emit('machines:updated');

    return res.json({ success: true, message: `Filter mesin ${id} berhasil di-reset ke 0 L.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
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

app.get('/api/status', async (req, res) => {
  let targetDeviceId = req.query.deviceId || null;
  if (req.user && req.user.role === 'CLIENT') {
    targetDeviceId = req.user.assignedMachineId || 'DEPOT-001';
  }
  const stats = await db.getTodayStats(targetDeviceId);
  const targetMachine = getOrCreateMachineState(targetDeviceId || 'DEPOT-001');
  const configuredSsid = await db.getSetting('wifi_ssid', 'WiFi_Depot_Air');

  return res.json({
    success: true,
    data: {
      ...targetMachine,
      totalRevenueToday: stats.totalRevenueToday,
      totalWaterDispensedToday: stats.totalWaterDispensedToday,
      totalOrdersToday: stats.totalOrdersToday,
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
  let targetDeviceId = req.query.deviceId || null;
  if (req.user && req.user.role === 'CLIENT') {
    targetDeviceId = req.user.assignedMachineId || 'DEPOT-001';
  }
  const tx = await db.getTransactions(100, targetDeviceId);
  return res.json({ success: true, total: tx.length, data: tx });
});

app.get('/api/logs', async (req, res) => {
  if (req.user && req.user.role === 'CLIENT') {
    return res.json({ success: true, total: 0, data: [] });
  }
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
  const dbMachines = await db.getMachines();
  const machinesWithLive = dbMachines.map(m => {
    const live = getOrCreateMachineState(m.id);
    return {
      ...m,
      status: live.esp32Status === 'ONLINE' ? live.status : 'OFFLINE',
      esp32Status: live.esp32Status,
      esp32LastSeen: live.esp32LastSeen || m.lastSeen,
      esp32Ip: live.esp32Ip || m.ip,
      esp32CurrentSsid: live.esp32CurrentSsid || m.ssid,
      activeOrder: live.activeOrder,
      currentLiter: live.currentLiter,
      flowRate: live.flowRate
    };
  });
  socket.emit('init:data', {
    transactions: tx,
    logs: logs,
    state: currentState,
    machines: machinesWithLive
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
