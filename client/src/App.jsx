import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Droplet, 
  Wifi, 
  WifiOff, 
  Activity, 
  Zap, 
  TrendingUp, 
  DollarSign, 
  Cpu, 
  ShieldCheck, 
  RefreshCw,
  Terminal,
  History,
  Server,
  Layers,
  Sparkles
} from 'lucide-react';

import WaterDispenserVisualizer from './components/WaterDispenserVisualizer';
import OrderSimulator from './components/OrderSimulator';
import WebhookInspector from './components/WebhookInspector';
import TransactionHistory from './components/TransactionHistory';
import HardwareConfigGuide from './components/HardwareConfigGuide';
import WifiSettingsCard from './components/WifiSettingsCard';

export default function App() {
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // State
  const [systemState, setSystemState] = useState({
    status: 'IDLE',
    activeOrder: null,
    esp32Status: 'OFFLINE',
    esp32Ip: null,
    totalWaterDispensedToday: 0,
    totalRevenueToday: 0
  });

  const [telemetry, setTelemetry] = useState({
    currentLiter: 0,
    pulses: 0,
    flowRate: 0
  });

  const [transactions, setTransactions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activePendingOrder, setActivePendingOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [publicBaseUrl, setPublicBaseUrl] = useState('https://dana.aspartech.com');

  // Initialize Socket.io and initial HTTP data fetch
  useEffect(() => {
    // 1. Fetch initial status from REST API
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSystemState(prev => ({ ...prev, ...data.data }));
          if (data.data.publicBaseUrl) {
            setPublicBaseUrl(data.data.publicBaseUrl);
          }
        }
      })
      .catch(err => console.error('Failed to fetch status:', err));

    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => {
        if (data.success) setTransactions(data.data || []);
      })
      .catch(err => console.error('Failed to fetch transactions:', err));

    fetch('/api/logs')
      .then(res => res.json())
      .then(data => {
        if (data.success) setLogs(data.data || []);
      })
      .catch(err => console.error('Failed to fetch logs:', err));

    // 2. Setup WebSocket
    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setSocketConnected(true);
      console.log('⚡ Socket.IO Connected');
    });

    newSocket.on('disconnect', () => {
      setSocketConnected(false);
    });

    newSocket.on('system:state', (state) => {
      setSystemState(prev => ({ ...prev, ...state }));
      if (state.status === 'IDLE') {
        setTelemetry({ currentLiter: 0, pulses: 0, flowRate: 0 });
      }
    });

    newSocket.on('order:created', (order) => {
      setActivePendingOrder(order);
      setTransactions(prev => [order, ...prev]);
    });

    newSocket.on('order:paid', (order) => {
      setActivePendingOrder(null);
      setTransactions(prev => prev.map(t => t.orderId === order.orderId ? { ...t, ...order, status: 'PAID' } : t));
    });

    newSocket.on('order:completed', (result) => {
      setTransactions(prev => prev.map(t => t.orderId === result.orderId ? { ...t, ...result } : t));
    });

    newSocket.on('log:new', (logItem) => {
      setLogs(prev => [logItem, ...prev.slice(0, 250)]);
    });

    newSocket.on('esp32:telemetry', (data) => {
      setTelemetry(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Action Handlers
  const handleSimulatePayment = async (orderId) => {
    try {
      const res = await fetch('/api/dana/simulate-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (data.success) {
        setActivePendingOrder(null);
      }
    } catch (err) {
      console.error('Simulate payment failed:', err);
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await fetch('/api/depot/emergency-stop', { method: 'POST' });
    } catch (err) {
      console.error('Emergency stop error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white pb-12">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Droplet className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white tracking-tight text-base sm:text-lg">
                  DEPOT AIR DANA
                </h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Sandbox IoT
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Otomatisasi Pengisian Air Terintegrasi Webhook & ESP32
              </p>
            </div>
          </div>

          {/* Right Status Badges */}
          <div className="flex items-center gap-3">
            {/* ESP32 Online / Offline Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              systemState.esp32Status === 'ONLINE'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {systemState.esp32Status === 'ONLINE' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ESP32 ONLINE</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span>ESP32 OFFLINE</span>
                </>
              )}
            </div>

            {/* Socket Status */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800 font-mono">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>WS: {socketConnected ? 'Live' : 'Connecting'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 flex-1 w-full space-y-6">
        
        {/* Top Summary Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today Revenue */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Pendapatan Hari Ini</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono">
              Rp {(systemState.totalRevenueToday || 0).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-emerald-400/90 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Transaksi DANA Sukses
            </div>
          </div>

          {/* Card 2: Liters Dispensed */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Air Terdistribusi</span>
              <Droplet className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-cyan-300 font-mono">
              {(systemState.totalWaterDispensedToday || 0).toFixed(1)} <span className="text-sm font-normal text-slate-400">Liter</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Dihitung via Flow Sensor GPIO 18
            </div>
          </div>

          {/* Card 3: Total Orders */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Total Pesanan</span>
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-purple-300 font-mono">
              {transactions.length} <span className="text-sm font-normal text-slate-400">Order</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {transactions.filter(t => t.status === 'COMPLETED').length} sukses terisi
            </div>
          </div>

          {/* Card 4: Hardware & Webhook Endpoint */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Domain Webhook</span>
              <Server className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xs font-bold text-white font-mono truncate">
              {publicBaseUrl.replace('https://', '').replace('http://', '')}
            </div>
            <div className="text-[11px] text-blue-400 mt-1 font-mono truncate">
              /api/dana/finish-notify
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Monitor & Kiosk', icon: Droplet },
            { id: 'wifi', label: 'Pengaturan WiFi ESP32', icon: Wifi },
            { id: 'inspector', label: 'Webhook & ESP32 Live Log', icon: Terminal },
            { id: 'transactions', label: 'Riwayat Transaksi', icon: History },
            { id: 'hardware', label: 'Konfigurasi & Wiring', icon: Cpu }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Dashboard (Monitor + Order Simulator) */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <WaterDispenserVisualizer
                systemState={systemState}
                telemetry={telemetry}
                onEmergencyStop={handleEmergencyStop}
              />
            </div>
            <div className="lg:col-span-5">
              <OrderSimulator
                onOrderCreated={(order) => setActivePendingOrder(order)}
                onSimulatePayment={handleSimulatePayment}
                activePendingOrder={activePendingOrder}
              />
            </div>
          </div>
        )}

        {/* Tab 2: WiFi Settings */}
        {activeTab === 'wifi' && (
          <WifiSettingsCard systemState={systemState} />
        )}

        {/* Tab 2: Webhook & Logs Inspector */}
        {activeTab === 'inspector' && (
          <WebhookInspector logs={logs} />
        )}

        {/* Tab 3: Transaction History */}
        {activeTab === 'transactions' && (
          <TransactionHistory transactions={transactions} />
        )}

        {/* Tab 4: Hardware & Endpoint Docs */}
        {activeTab === 'hardware' && (
          <HardwareConfigGuide baseUrl={publicBaseUrl} />
        )}

      </main>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-slate-500 font-mono">
        AsparTech • Sistem Depot Air Isi Ulang Otomatis Terintegrasi DANA Sandbox & ESP32
      </footer>
    </div>
  );
}
