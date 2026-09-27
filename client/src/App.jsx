import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Droplet, 
  Wifi, 
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
  Sparkles,
  Database,
  CheckCircle2
} from 'lucide-react';

import WaterDispenserVisualizer from './components/WaterDispenserVisualizer';
import OrderSimulator from './components/OrderSimulator';
import WebhookInspector from './components/WebhookInspector';
import TransactionHistory from './components/TransactionHistory';
import HardwareConfigGuide from './components/HardwareConfigGuide';
import WifiSettingsCard from './components/WifiSettingsCard';
import PackageManagerCard from './components/PackageManagerCard';

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
    totalRevenueToday: 0,
    isMySql: false,
    databaseType: 'MySQL / MariaDB'
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

    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setSocketConnected(true);
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
      setTransactions(prev => prev.map(t => (t.orderId === order.orderId || t.merchantTransId === order.orderId) ? { ...t, ...order, status: 'PAID' } : t));
    });

    newSocket.on('order:completed', (result) => {
      setTransactions(prev => prev.map(t => (t.orderId === result.orderId || t.merchantTransId === result.orderId) ? { ...t, ...result } : t));
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black pb-12 relative overflow-hidden font-sans">
      
      {/* Dynamic Ambient Blur Mesh */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[300px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[500px] h-[300px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 py-3 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#118EEA] via-blue-600 to-cyan-400 p-0.5 shadow-xl shadow-blue-500/30">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Droplet className="w-6 h-6 text-cyan-400 fill-cyan-400/20" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-white tracking-tight text-lg sm:text-xl">
                  DEPOT AIR DANA
                </h1>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#118EEA]/20 text-cyan-300 border border-cyan-500/30">
                  SMART IOT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Otomatisasi Pengisian Air Terintegrasi Webhook DANA & ESP32
              </p>
            </div>
          </div>

          {/* Right Status Badges */}
          <div className="flex items-center gap-2.5">
            
            {/* Database Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs font-semibold text-slate-300">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>{systemState?.databaseType || 'MySQL'}</span>
            </div>

            {/* ESP32 Online / Offline Status */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border text-xs font-bold transition-all ${
              systemState.esp32Status === 'ONLINE'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/40'
            }`}>
              <span className={`w-2 h-2 rounded-full ${systemState.esp32Status === 'ONLINE' ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
              <span>{systemState.esp32Status === 'ONLINE' ? 'ESP32 ONLINE' : 'ESP32 OFFLINE'}</span>
            </div>

            {/* WebSocket Status */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-2xl border border-slate-800 font-mono">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-cyan-400' : 'bg-amber-400'}`} />
              <span>WS: {socketConnected ? 'Live' : 'Connect'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 flex-1 w-full space-y-6 relative z-10">
        
        {/* Top Summary Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Today Revenue */}
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Pendapatan Hari Ini</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
              Rp {(systemState.totalRevenueToday || 0).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Transaksi DANA Sukses
            </div>
          </div>

          {/* Card 2: Liters Dispensed */}
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Air Terdistribusi</span>
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Droplet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-cyan-300 font-mono tracking-tight">
              {(systemState.totalWaterDispensedToday || 0).toFixed(1)} <span className="text-sm font-normal text-slate-400">Liter</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              Flow Sensor Metering GPIO 18
            </div>
          </div>

          {/* Card 3: Total Orders */}
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 relative overflow-hidden group hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Total Pesanan</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-300 font-mono tracking-tight">
              {transactions.length} <span className="text-sm font-normal text-slate-400">Pesanan</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              {transactions.filter(t => t.status === 'COMPLETED').length} sukses terisi penuh
            </div>
          </div>

          {/* Card 4: Webhook Domain */}
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 relative overflow-hidden group hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Domain Webhook</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xs font-black text-white font-mono truncate">
              {publicBaseUrl.replace('https://', '').replace('http://', '')}
            </div>
            <div className="text-[11px] text-cyan-400 mt-1 font-mono truncate">
              /api/dana/finish-notify
            </div>
          </div>
        </div>

        {/* Navigation Tabs Pill Bar */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Monitor & Kiosk', icon: Droplet },
            { id: 'packages', label: 'Kelola Paket Air & Harga', icon: Layers },
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-[#118EEA] to-cyan-500 text-white shadow-xl shadow-blue-500/25 scale-[1.02]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Dashboard */}
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
                systemState={systemState}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Packages */}
        {activeTab === 'packages' && (
          <PackageManagerCard onPackagesChanged={() => {}} />
        )}

        {/* Tab 3: WiFi */}
        {activeTab === 'wifi' && (
          <WifiSettingsCard systemState={systemState} />
        )}

        {/* Tab 4: Webhook Inspector */}
        {activeTab === 'inspector' && (
          <WebhookInspector logs={logs} />
        )}

        {/* Tab 5: Transactions */}
        {activeTab === 'transactions' && (
          <TransactionHistory transactions={transactions} />
        )}

        {/* Tab 6: Hardware & Docs */}
        {activeTab === 'hardware' && (
          <HardwareConfigGuide baseUrl={publicBaseUrl} />
        )}

      </main>

      {/* Footer */}
      <footer className="mt-14 text-center text-xs text-slate-500 font-mono">
        AsparTech • Sistem Depot Air Isi Ulang Otomatis Terintegrasi DANA Sandbox & ESP32
      </footer>
    </div>
  );
}
