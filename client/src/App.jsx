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
    <div className="min-h-screen bg-gradient-to-b from-[#031329] via-[#051c3d] to-[#020d1c] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black pb-12 relative overflow-hidden font-sans">
      
      {/* Dynamic Ambient Aquatic Shimmer & Glows */}
      <div className="absolute top-0 left-1/4 w-[750px] h-[360px] bg-gradient-to-br from-cyan-500/20 via-blue-600/15 to-transparent rounded-full blur-[150px] pointer-events-none water-shimmer" />
      <div className="absolute top-1/3 right-10 w-[650px] h-[360px] bg-gradient-to-bl from-sky-400/20 via-blue-700/15 to-transparent rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[700px] h-[250px] bg-sky-500/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Header */}
      <header className="border-b border-sky-500/20 bg-[#04162e]/85 backdrop-blur-2xl sticky top-0 z-50 shadow-lg shadow-[#020d1d]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 py-3 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0284c7] via-[#0ea5e9] to-cyan-300 p-0.5 shadow-xl shadow-cyan-500/30 ring-2 ring-cyan-400/30">
              <div className="w-full h-full bg-[#031733] rounded-[14px] flex items-center justify-center">
                <Droplet className="w-6 h-6 text-cyan-300 fill-cyan-400/30 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-sky-100 to-cyan-300 tracking-tight text-lg sm:text-xl">
                  DEPOT AIR DANA
                </h1>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-sm shadow-cyan-500/20">
                  SMART IOT
                </span>
              </div>
              <p className="text-[11px] text-sky-200/70 font-medium">
                Otomatisasi Pengisian Air Terintegrasi Webhook DANA & ESP32
              </p>
            </div>
          </div>

          {/* Right Status Badges */}
          <div className="flex items-center gap-2.5">
            
            {/* Database Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#062042]/90 border border-sky-500/30 text-xs font-semibold text-sky-200 shadow-sm">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>{systemState?.databaseType || 'MySQL'}</span>
            </div>

            {/* ESP32 Online / Offline Status */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border text-xs font-bold transition-all ${
              systemState.esp32Status === 'ONLINE'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/50 shadow-lg shadow-emerald-500/20'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/50'
            }`}>
              <span className={`w-2 h-2 rounded-full ${systemState.esp32Status === 'ONLINE' ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
              <span>{systemState.esp32Status === 'ONLINE' ? 'ESP32 ONLINE' : 'ESP32 OFFLINE'}</span>
            </div>

            {/* WebSocket Status */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-sky-200 bg-[#062042]/80 px-3 py-1.5 rounded-2xl border border-sky-500/30 font-mono shadow-sm">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'}`} />
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
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-sky-500/25 bg-gradient-to-br from-[#06244a]/80 via-[#041834]/85 to-[#020d1e]/90 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
            <div className="flex items-center justify-between text-sky-200/80 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Pendapatan Hari Ini</span>
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/20">
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
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-cyan-400/40 bg-gradient-to-br from-[#052b54]/80 via-[#041d3d]/85 to-[#020d1e]/90 shadow-xl shadow-cyan-950/40 relative overflow-hidden group hover:border-cyan-300 transition-all">
            <div className="flex items-center justify-between text-cyan-200/80 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Air Terdistribusi</span>
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 shadow-sm shadow-cyan-500/30">
                <Droplet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-sky-300 to-blue-200 font-mono tracking-tight">
              {(systemState.totalWaterDispensedToday || 0).toFixed(1)} <span className="text-sm font-normal text-sky-300/80">Liter</span>
            </div>
            <div className="text-[11px] text-sky-300/80 font-medium mt-1">
              Flow Sensor Metering GPIO 34 (YF-S201)
            </div>
          </div>

          {/* Card 3: Total Orders */}
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-blue-500/30 bg-gradient-to-br from-[#07244c]/80 via-[#041936]/85 to-[#020d1e]/90 relative overflow-hidden group hover:border-sky-400/50 transition-all">
            <div className="flex items-center justify-between text-sky-200/80 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Total Pesanan</span>
              <div className="p-2 rounded-xl bg-sky-500/15 text-sky-300 shadow-sm shadow-sky-500/20">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-sky-100 font-mono tracking-tight">
              {transactions.length} <span className="text-sm font-normal text-sky-300/80">Pesanan</span>
            </div>
            <div className="text-[11px] text-sky-300/80 font-medium mt-1">
              {transactions.filter(t => t.status === 'COMPLETED').length} sukses terisi penuh
            </div>
          </div>

          {/* Card 4: Webhook Domain */}
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-teal-500/30 bg-gradient-to-br from-[#052745]/80 via-[#031a30]/85 to-[#020d1e]/90 relative overflow-hidden group hover:border-cyan-400/50 transition-all">
            <div className="flex items-center justify-between text-sky-200/80 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Domain Webhook</span>
              <div className="p-2 rounded-xl bg-teal-500/15 text-teal-300 shadow-sm shadow-teal-500/20">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xs font-black text-white font-mono truncate">
              {publicBaseUrl.replace('https://', '').replace('http://', '')}
            </div>
            <div className="text-[11px] text-cyan-300 mt-1 font-mono truncate">
              /api/dana/finish-notify
            </div>
          </div>
        </div>

        {/* Navigation Tabs Pill Bar */}
        <div className="flex items-center gap-2 border-b border-sky-500/20 pb-3 overflow-x-auto">
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
                    ? 'bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] text-white shadow-xl shadow-sky-500/35 ring-1 ring-sky-300/40 scale-[1.02]'
                    : 'text-sky-200/70 hover:text-white hover:bg-sky-950/50 hover:border-sky-400/40 border border-sky-900/40 bg-[#051c3d]/40'
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
      <footer className="mt-14 text-center text-xs text-sky-400/60 font-mono flex items-center justify-center gap-1.5">
        <Droplet className="w-3.5 h-3.5 text-cyan-400 fill-current" />
        <span>AsparTech • Sistem Depot Air Isi Ulang Otomatis Terintegrasi DANA Sandbox & ESP32</span>
      </footer>
    </div>
  );
}
