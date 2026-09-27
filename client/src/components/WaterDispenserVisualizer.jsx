import React, { useState, useEffect, useMemo } from 'react';
import { Droplet, Activity, Zap, ShieldAlert, Sparkles, Volume2, CheckCircle, Clock, Gauge, ArrowDown, Play, Pause } from 'lucide-react';

export default function WaterDispenserVisualizer({ systemState, telemetry, onEmergencyStop }) {
  const isPaid = systemState?.status === 'PAID';
  const isFilling = systemState?.status === 'FILLING';
  const isPaused = systemState?.status === 'PAUSED';
  const isIdle = systemState?.status === 'IDLE';
  const isStopped = systemState?.status === 'EMERGENCY_STOP' || systemState?.status === 'STOPPED';

  const [isToggling, setIsToggling] = useState(false);
  const [lastToggleTime, setLastToggleTime] = useState(0);

  const handleToggleWater = async () => {
    const now = Date.now();
    if (now - lastToggleTime < 800 || isToggling) return;
    setLastToggleTime(now);

    try {
      setIsToggling(true);
      await fetch('/api/dispenser/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE' })
      });
    } catch (err) {
      console.error('Failed to toggle dispenser:', err);
    } finally {
      setTimeout(() => setIsToggling(false), 500);
    }
  };

  const targetLiter = Number(systemState?.activeOrder?.targetLiter) || (isPaid ? 19 : 0);
  const currentLiter = Number(telemetry?.currentLiter) || 0;
  
  // Calculate percentage
  const percentage = targetLiter > 0 
    ? Math.min(100, Math.round((currentLiter / targetLiter) * 100))
    : (isPaid ? 4 : 0);

  // Generate random bubbles when filling
  const bubbles = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      left: `${15 + (i * 7) % 70}%`,
      size: `${4 + (i % 5) * 2}px`,
      delay: `${(i * 0.3) % 2}s`,
      duration: `${1.6 + (i % 3) * 0.4}s`
    }));
  }, []);

  return (
    <div className={`rounded-3xl p-6 sm:p-7 relative overflow-hidden transition-all duration-500 ${
      isFilling 
        ? 'glass-card-glow border-cyan-400/50 shadow-2xl shadow-cyan-950/60' 
        : isPaid 
        ? 'glass-card-emerald border-cyan-500/40' 
        : 'glass-card border-sky-500/30'
    }`}>
      {/* Dynamic Ambient Background Aquatic Glows */}
      <div className={`absolute -top-32 -left-32 w-80 h-80 rounded-full blur-[100px] pointer-events-none transition-all duration-1000 ${
        isFilling ? 'bg-cyan-500/30' : isPaid ? 'bg-sky-400/25' : 'bg-blue-600/20'
      }`} />
      <div className={`absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-[100px] pointer-events-none transition-all duration-1000 ${
        isFilling ? 'bg-blue-500/30' : isPaid ? 'bg-cyan-500/25' : 'bg-sky-600/20'
      }`} />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-sky-500/20 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
            isFilling 
              ? 'bg-gradient-to-tr from-cyan-400 via-blue-500 to-sky-300 text-white shadow-lg shadow-cyan-500/40 animate-pulse' 
              : isPaid 
              ? 'bg-gradient-to-tr from-sky-500 to-teal-400 text-white shadow-lg shadow-sky-500/30' 
              : 'bg-[#06244d] border border-sky-500/30 text-sky-300'
          }`}>
            <Droplet className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-sky-100 to-cyan-300 tracking-tight">
                Smart Water Dispenser
              </h2>
              <span className={`text-[11px] px-3 py-1 rounded-full font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                isFilling 
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm shadow-cyan-500/30' 
                  : isPaid 
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-400/50 animate-pulse' 
                  : 'bg-[#062042] text-sky-300 border border-sky-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isFilling ? 'bg-cyan-400 animate-ping' : isPaid ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                {systemState?.status || 'IDLE'}
              </span>
            </div>
            <p className="text-xs text-sky-200/70 mt-0.5">
              ESP32 Solenoid (GPIO 26) • Flow Sensor (GPIO 34) • Tombol Kucur Air (GPIO 32)
            </p>
          </div>
        </div>

        {/* Emergency Stop Button */}
        {(isFilling || isPaid) && (
          <button
            onClick={onEmergencyStop}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-xl shadow-rose-600/30 transition-all duration-200 animate-bounce"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>EMERGENCY STOP (WEB)</span>
          </button>
        )}
      </div>

      {/* Main Interactive Visualizer Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        
        {/* Left Column: 3D High-Tech Water Galon Cylinder */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          
          {/* Top Dispenser Nozzle / Faucet */}
          <div className="relative flex flex-col items-center">
            <div className="w-16 h-3 bg-gradient-to-r from-slate-600 via-sky-400 to-slate-600 rounded-t-md shadow-md" />
            <div className="w-6 h-4 bg-slate-600 border-x border-sky-400/50 relative flex items-center justify-center">
              {isFilling && (
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              )}
            </div>
            {/* Water Stream Nozzle Effect */}
            {isFilling && (
              <div className="w-2 h-7 bg-gradient-to-b from-cyan-200 via-sky-400 to-cyan-300 animate-pulse shadow-[0_0_15px_rgba(56,189,248,1)] z-20" />
            )}
          </div>

          {/* Main 3D Water Tank Body */}
          <div className="relative w-56 h-72 bg-gradient-to-b from-[#06244c]/90 via-[#031b3b]/95 to-[#021226]/98 rounded-[32px] border-4 border-cyan-400/40 p-2 shadow-2xl shadow-cyan-950/70 flex flex-col justify-end overflow-hidden backdrop-blur-md">
            
            {/* Glossy Glass Reflection Overlay */}
            <div className="absolute top-0 left-3 w-6 h-full bg-gradient-to-r from-white/15 to-transparent pointer-events-none z-30 rounded-l-2xl" />
            <div className="absolute top-0 right-3 w-3 h-full bg-gradient-to-l from-white/10 to-transparent pointer-events-none z-30 rounded-r-2xl" />

            {/* Scale Measurement Hash Lines */}
            <div className="absolute right-3 top-6 bottom-6 flex flex-col justify-between text-[10px] font-mono text-slate-500 z-20 pointer-events-none select-none">
              <span className="flex items-center gap-1 font-bold text-slate-400"><span className="w-2 h-[1px] bg-slate-500 inline-block"/> {targetLiter || 19}L</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-[1px] bg-slate-600 inline-block"/> {((targetLiter || 19) * 0.75).toFixed(0)}L</span>
              <span className="flex items-center gap-1"><span className="w-2 h-[1px] bg-slate-500 inline-block"/> {((targetLiter || 19) * 0.5).toFixed(0)}L</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-[1px] bg-slate-600 inline-block"/> {((targetLiter || 19) * 0.25).toFixed(0)}L</span>
              <span className="flex items-center gap-1 font-bold text-slate-500"><span className="w-2 h-[1px] bg-slate-500 inline-block"/> 0L</span>
            </div>

            {/* Rising Bubbles inside Water */}
            {isFilling && bubbles.map(b => (
              <div
                key={b.id}
                className="bubble z-20"
                style={{
                  left: b.left,
                  width: b.size,
                  height: b.size,
                  animationDelay: b.delay,
                  animationDuration: b.duration
                }}
              />
            ))}

            {/* Water Liquid Body */}
            <div 
              className="w-full water-fill-gradient rounded-2xl relative transition-all duration-700 ease-out flex items-center justify-center overflow-hidden shadow-[inset_0_4px_16px_rgba(255,255,255,0.3)]"
              style={{ height: `${Math.max(percentage, isPaid ? 8 : 4)}%` }}
            >
              {/* Animated Wave Surface */}
              {isFilling && (
                <div className="absolute -top-2 left-0 right-0 h-4 bg-cyan-200/50 rounded-full animate-wave" />
              )}
            </div>

            {/* Center Digital Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none">
              <div className="bg-[#031735]/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-cyan-400/40 shadow-2xl flex flex-col items-center">
                <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-sky-300 to-blue-300 font-mono tracking-tight">
                  {currentLiter.toFixed(1)} <span className="text-xs font-semibold text-sky-300/80 font-sans">/ {targetLiter} L</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400" />
                  <span className="text-[11px] font-extrabold text-cyan-200 font-mono tracking-wide">
                    {percentage}% TERISI
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs font-semibold text-sky-200 mt-3 font-mono bg-[#052042]/90 px-3.5 py-1 rounded-full border border-sky-500/30 shadow-sm">
            💧 {systemState?.activeOrder?.title || 'Galon 19 Liter'}
          </div>
        </div>

        {/* Right Column: Hardware Telemetry HUD Gauges */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Active Order Card & Dynamic Colored Button */}
          {(systemState?.activeOrder || isPaid || isFilling || isPaused) ? (
            <div className={`p-5 rounded-2xl border space-y-3 shadow-2xl relative overflow-hidden transition-all duration-300 ${
              isFilling 
                ? 'bg-gradient-to-r from-[#06294d] via-emerald-950/30 to-[#041c38] border-emerald-500/40 shadow-emerald-950/40' 
                : 'bg-gradient-to-r from-[#06294d] via-rose-950/30 to-[#041c38] border-rose-500/40 shadow-rose-950/40'
            }`}>
              <div className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-2xl pointer-events-none ${
                isFilling ? 'bg-emerald-500/15' : 'bg-rose-500/15'
              }`} />
              
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                  isFilling ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  <Sparkles className="w-3.5 h-3.5" /> Transaksi Sedang Berjalan
                </span>
                <span className="text-[11px] font-mono text-sky-200 bg-[#03152d] px-2.5 py-0.5 rounded-lg border border-sky-500/30">
                  {systemState?.activeOrder?.orderId || 'DANA-ACTIVE'}
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-0.5">
                <h3 className="text-lg font-black text-white tracking-tight">
                  {systemState?.activeOrder?.title || 'Isi Ulang Galon 19 Liter'}
                </h3>
                <span className="text-2xl font-black text-emerald-400 font-mono drop-shadow">
                  Rp {Number(systemState?.activeOrder?.amount || 7000).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="text-xs text-sky-200/70 flex items-center justify-between pt-2 border-t border-sky-500/20">
                <span>Pelanggan: <strong className="text-white">{systemState?.activeOrder?.customerName || 'Pelanggan Depot'}</strong></span>
                <span>Waktu Bayar: <strong className="text-cyan-300 font-mono">{new Date(systemState?.activeOrder?.paidAt || Date.now()).toLocaleTimeString('id-ID')}</strong></span>
              </div>

              {/* TOMBOL WARNA DINAMIS: MERAH (SIAP/JEDA) <---> HIJAU (MENGUCUR) */}
              <div className="pt-2">
                {isFilling ? (
                  <button
                    type="button"
                    onClick={handleToggleWater}
                    disabled={isToggling}
                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.98] text-white font-black text-sm shadow-[0_0_30px_rgba(34,197,94,0.4)] ring-4 ring-emerald-400/40 border border-emerald-300/40 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-white animate-ping" />
                      <Pause className="w-5 h-5 fill-current" />
                      <span className="tracking-wide">🟢 TOMBOL HIJAU: AIR SEDANG MENGUCUR</span>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-100 opacity-90">
                      Klik di sini atau Tekan Tombol D32 di ESP32 untuk JEDA (PAUSE)
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleToggleWater}
                    disabled={isToggling}
                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 active:scale-[0.98] text-white font-black text-sm shadow-[0_0_30px_rgba(239,68,68,0.4)] ring-4 ring-rose-500/40 border border-rose-300/40 animate-pulse flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-white" />
                      <Play className="w-5 h-5 fill-current" />
                      <span className="tracking-wide">
                        {isPaused ? '🔴 TOMBOL MERAH: AIR DIJEDA' : '🔴 TOMBOL MERAH: SUDAH BAYAR & SIAP'}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-rose-100 opacity-90">
                      Klik di sini atau Tekan Tombol D32 di ESP32 untuk {isPaused ? 'LANJUTKAN AIR' : 'MULAI KUCURKAN AIR'}
                    </span>
                  </button>
                )}

                <div className="flex items-center justify-between text-[11px] text-sky-200/70 mt-2 px-1">
                  <span>💡 Lampu Tombol Fisik: <strong className="text-rose-400">D21 (Merah)</strong> • <strong className="text-emerald-400">D22 (Hijau)</strong></span>
                  <span>🔘 Tombol Push: <strong className="text-cyan-300 font-mono">GPIO 32</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#051f40]/70 p-5 rounded-2xl border border-sky-500/30 text-center py-7 shadow-lg shadow-sky-950/30">
              <p className="text-sm font-medium text-sky-100">
                Depot dalam keadaan <strong className="text-cyan-300 font-bold">STANDBY (IDLE)</strong>
              </p>
              <p className="text-xs text-sky-300/70 mt-1">
                Pilih paket di panel samping atau scan QRIS DANA Sandbox untuk memulai.
              </p>
            </div>
          )}

          {/* 3 Hardware HUD Cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* Card 1: Solenoid Valve */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isFilling 
                ? 'bg-cyan-950/60 border-cyan-400/70 shadow-lg shadow-cyan-950/50' 
                : 'bg-[#06244d]/70 border-sky-500/30'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-sky-200/80">Solenoid Valve</span>
                <Zap className={`w-4 h-4 ${isFilling ? 'text-cyan-300 animate-pulse' : 'text-sky-500/60'}`} />
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isFilling ? 'bg-cyan-400 animate-ping' : 'bg-sky-600'}`} />
                <span className={`text-sm font-black font-mono tracking-wide ${isFilling ? 'text-cyan-300' : 'text-sky-300'}`}>
                  {isFilling ? 'TERBUKA' : 'TERTUTUP'}
                </span>
              </div>
              <span className="text-[10px] text-sky-400/60 font-mono mt-1 block">GPIO 26 (Relay)</span>
            </div>

            {/* Card 2: Flow Sensor */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isFilling 
                ? 'bg-blue-950/60 border-blue-400/70 shadow-lg shadow-blue-950/50' 
                : 'bg-[#06244d]/70 border-sky-500/30'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-sky-200/80">Flow Sensor</span>
                <Gauge className={`w-4 h-4 ${isFilling ? 'text-sky-300 animate-spin' : 'text-sky-500/60'}`} />
              </div>
              <div className="text-sm font-black font-mono text-white">
                {telemetry?.flowRate ? telemetry.flowRate.toFixed(1) : (isFilling ? '4.8' : '0.0')} <span className="text-[10px] text-sky-300/70 font-normal">L/min</span>
              </div>
              <span className="text-[10px] text-sky-400/60 font-mono mt-1 block">GPIO 34 (YF-S201)</span>
            </div>

            {/* Card 3: Buzzer Alert */}
            <div className="p-4 rounded-2xl border bg-[#06244d]/70 border-sky-500/30">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-sky-200/80">Audio Buzzer</span>
                <Volume2 className={`w-4 h-4 ${isFilling ? 'text-cyan-400' : 'text-sky-500/60'}`} />
              </div>
              <div className="text-sm font-black font-mono text-sky-100">
                {isFilling ? '1x Mulai' : percentage >= 100 ? '4x Selesai' : 'Standby'}
              </div>
              <span className="text-[10px] text-sky-400/60 font-mono mt-1 block">GPIO 19</span>
            </div>
          </div>

          {/* Polling Health bar */}
          <div className="bg-[#03152d]/90 px-4 py-3 rounded-2xl border border-sky-500/30 flex items-center justify-between text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${systemState?.esp32Status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-sky-200 font-medium">
                Koneksi Polling ESP32: <strong className="text-cyan-300 font-mono">/api/esp32/check-order</strong>
              </span>
            </div>
            <span className="text-sky-300/80 font-mono text-[11px]">
              IP: {systemState?.esp32Ip || 'Offline'}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
