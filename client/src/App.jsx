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
    <div className="min-h-screen bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd] text-[#0c2e55] flex flex-col selection:bg-sky-400 selection:text-white pb-10 relative overflow-x-hidden font-sans">
      
      {/* Dynamic Ambient Aquatic Shimmer & Glows */}
      <div className="absolute top-0 left-1/4 w-[750px] h-[360px] bg-gradient-to-br from-white/70 via-sky-300/30 to-transparent rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[650px] h-[360px] bg-gradient-to-bl from-cyan-300/35 via-sky-200/40 to-transparent rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[700px] h-[250px] bg-sky-300/25 rounded-full blur-[110px] pointer-events-none" />

      {/* Top Header - AIRO Smart Water Kiosk Style */}
      <header className="border-b border-sky-200/90 bg-white/90 backdrop-blur-2xl sticky top-0 z-50 shadow-md shadow-sky-500/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 py-3 flex items-center justify-between">
          
          {/* Brand Logo & Banner */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] p-0.5 shadow-lg shadow-sky-500/30 ring-2 ring-sky-300">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                <Droplet className="w-7 h-7 text-[#0284c7] fill-[#38bdf8]/40 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-[#034078] tracking-tight text-xl sm:text-2xl flex items-center gap-1.5">
                  <span>DEPOT AIR DANA</span>
                  <span className="text-sky-500 text-sm font-extrabold uppercase">SMART WATER</span>
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-sky-100 text-[#0284c7] border border-sky-300 font-mono shadow-sm">
                  REVERSE OSMOSIS
                </span>
              </div>
              <p className="text-[11px] text-sky-700/80 font-semibold tracking-wide flex items-center gap-1">
                <span>FRESH & PURE SYSTEM</span>
                <span>•</span>
                <span>Otomatisasi Pengisian Air Terintegrasi Webhook DANA & ESP32</span>
              </p>
            </div>
          </div>

          {/* Right Status Badges */}
          <div className="flex items-center gap-2.5">
            
            {/* Database Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-white border border-sky-200 text-xs font-bold text-sky-800 shadow-sm">
              <Database className="w-3.5 h-3.5 text-[#0284c7]" />
              <span>{systemState?.databaseType || 'MySQL'}</span>
            </div>

            {/* ESP32 Online / Offline Status */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border text-xs font-black tracking-wide shadow-sm transition-all ${
              systemState.esp32Status === 'ONLINE'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-emerald-500/10'
                : 'bg-rose-50 text-rose-700 border-rose-300'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${systemState.esp32Status === 'ONLINE' ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
              <span>{systemState.esp32Status === 'ONLINE' ? 'ESP32 ONLINE' : 'ESP32 OFFLINE'}</span>
            </div>

            {/* WebSocket Status */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-sky-800 bg-white px-3 py-1.5 rounded-2xl border border-sky-200 font-mono shadow-sm">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-sky-500 animate-pulse' : 'bg-amber-400'}`} />
              <span>WS: {socketConnected ? 'Live' : 'Connect'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 flex-1 w-full space-y-6 relative z-10">
        
        {/* Top Summary Stats Cards (Clean White Kiosk Panels) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Today Revenue */}
          <div className="bg-white/95 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border-2 border-sky-200 hover:border-sky-400 shadow-lg shadow-sky-900/5 transition-all group">
            <div className="flex items-center justify-between text-sky-800/80 mb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider">Pendapatan Hari Ini</span>
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shadow-sm">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tracking-tight">
              Rp {(systemState.totalRevenueToday || 0).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Transaksi DANA Sukses
            </div>
          </div>

          {/* Card 2: Liters Dispensed */}
          <div className="bg-white/95 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border-2 border-sky-300 hover:border-sky-400 shadow-lg shadow-sky-900/5 transition-all group">
            <div className="flex items-center justify-between text-sky-800/80 mb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider">Air Terdistribusi</span>
              <div className="p-2 rounded-xl bg-sky-100 text-[#0284c7] shadow-sm">
                <Droplet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#034078] font-mono tracking-tight">
              {(systemState.totalWaterDispensedToday || 0).toFixed(1)} <span className="text-sm font-bold text-sky-600">Liter</span>
            </div>
            <div className="text-[11px] text-sky-700 font-medium mt-1">
              Flow Sensor Metering GPIO 34
            </div>
          </div>

          {/* Card 3: Total Orders */}
          <div className="bg-white/95 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border-2 border-sky-200 hover:border-sky-400 shadow-lg shadow-sky-900/5 transition-all group">
            <div className="flex items-center justify-between text-sky-800/80 mb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider">Total Pesanan</span>
              <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shadow-sm">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#034078] font-mono tracking-tight">
              {transactions.length} <span className="text-sm font-bold text-sky-600">Pesanan</span>
            </div>
            <div className="text-[11px] text-sky-700 font-medium mt-1">
              {transactions.filter(t => t.status === 'COMPLETED').length} sukses terisi penuh
            </div>
          </div>

          {/* Card 4: Webhook Domain */}
          <div className="bg-white/95 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border-2 border-sky-200 hover:border-sky-400 shadow-lg shadow-sky-900/5 transition-all group">
            <div className="flex items-center justify-between text-sky-800/80 mb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider">Domain Webhook</span>
              <div className="p-2 rounded-xl bg-teal-100 text-teal-700 shadow-sm">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xs font-black text-[#034078] font-mono truncate">
              {publicBaseUrl.replace('https://', '').replace('http://', '')}
            </div>
            <div className="text-[11px] text-sky-600 mt-1 font-mono truncate font-semibold">
              /api/dana/finish-notify
            </div>
          </div>
        </div>

        {/* Navigation Tabs Pill Bar */}
        <div className="flex items-center gap-2 border-b border-sky-300/80 pb-3 overflow-x-auto">
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] text-white shadow-lg shadow-sky-500/30 ring-2 ring-sky-300 scale-[1.02]'
                    : 'text-sky-800 hover:text-[#034078] hover:bg-white bg-white/70 border border-sky-200/80 shadow-sm'
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
          <div className="space-y-6">
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

            {/* Kiosk Bottom Guide Banner: "CARA PENGGUNAAN" (AIRO Style) */}
            <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border-2 border-sky-300 shadow-xl shadow-sky-900/5">
              <div className="flex justify-center -mt-8 mb-4">
                <div className="bg-[#0284c7] text-white px-6 py-1.5 rounded-full text-xs font-black tracking-widest uppercase shadow-md shadow-sky-600/30 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  CARA PENGGUNAAN KIOSK
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
                {[
                  { step: '1', title: 'Simpan Galon', desc: 'Letakkan di ruang pengisian' },
                  { step: '2', title: 'Pilih Ukuran', desc: 'Pilih liter di layar kiosk' },
                  { step: '3', title: 'Bayar QRIS', desc: 'Scan DANA / e-Wallet' },
                  { step: '4', title: 'Tombol Merah', desc: 'Tekan tombol saat siap' },
                  { step: '5', title: 'Air Mengucur', desc: 'Lampu berubah hijau' },
                  { step: '6', title: 'Jeda / Lanjut', desc: 'Tekan tombol untuk jeda' },
                  { step: '7', title: 'Selesai', desc: 'Buzzer 4x & ambil galon' },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center p-3 rounded-2xl bg-sky-50/70 border border-sky-200/90 relative group hover:bg-sky-100/70 transition-all">
                    <div className="w-8 h-8 rounded-full bg-[#0284c7] text-white font-black text-xs flex items-center justify-center mb-2 shadow-sm shadow-sky-500/30">
                      {item.step}
                    </div>
                    <span className="font-extrabold text-xs text-[#034078]">{item.title}</span>
                    <span className="text-[10px] text-sky-700/90 font-medium mt-0.5">{item.desc}</span>
                  </div>
                ))}
              </div>
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
      <footer className="mt-12 text-center text-xs text-sky-800/80 font-medium flex items-center justify-center gap-1.5">
        <Droplet className="w-4 h-4 text-[#0284c7] fill-current" />
        <span>AsparTech AIRO • Sistem Depot Air Minum Isi Ulang Otomatis Terintegrasi DANA & ESP32</span>
      </footer>
    </div>
  );
}
