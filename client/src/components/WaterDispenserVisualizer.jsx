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
    <div className={`rounded-3xl p-6 sm:p-7 relative overflow-hidden transition-all duration-500 bg-white/95 border-2 ${
      isFilling 
        ? 'border-sky-400 shadow-2xl shadow-sky-500/20' 
        : isPaid 
        ? 'border-emerald-400 shadow-xl shadow-emerald-500/15' 
        : 'border-sky-200 shadow-lg shadow-sky-900/5'
    }`}>
      {/* Dynamic Ambient Background Aquatic Glows */}
      <div className={`absolute -top-32 -left-32 w-80 h-80 rounded-full blur-[100px] pointer-events-none transition-all duration-1000 ${
        isFilling ? 'bg-sky-400/25' : isPaid ? 'bg-emerald-300/20' : 'bg-sky-200/30'
      }`} />
      <div className={`absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-[100px] pointer-events-none transition-all duration-1000 ${
        isFilling ? 'bg-cyan-400/20' : isPaid ? 'bg-sky-300/20' : 'bg-blue-100/50'
      }`} />

      {/* Header Bar - Styled like "RUANG PENGISIAN" sign in AIRO Kiosk */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-sky-200 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
            isFilling 
              ? 'bg-gradient-to-tr from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] text-white shadow-lg shadow-sky-500/40 animate-pulse' 
              : isPaid 
              ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30' 
              : 'bg-sky-100 text-[#0284c7] border border-sky-300'
          }`}>
            <Droplet className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-[#0284c7] text-white text-xs font-black tracking-wider uppercase shadow-sm shadow-sky-600/30 flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 fill-current" />
                RUANG PENGISIAN
              </span>
              <span className={`text-[11px] px-3 py-1 rounded-full font-black uppercase tracking-wider flex items-center gap-1.5 border ${
                isFilling 
                  ? 'bg-sky-100 text-sky-800 border-sky-300 shadow-sm' 
                  : isPaid 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse' 
                  : isPaused
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isFilling ? 'bg-sky-500 animate-ping' : isPaid ? 'bg-emerald-500' : isPaused ? 'bg-amber-500' : 'bg-slate-400'}`} />
                {systemState?.status || 'IDLE'}
              </span>
            </div>
            <p className="text-xs text-sky-800/80 font-medium mt-1">
              ESP32 Solenoid (GPIO 26) • Flow Sensor (GPIO 34) • Tombol Kucur Air (GPIO 32)
            </p>
          </div>
        </div>

        {/* Emergency Stop Button */}
        {(isFilling || isPaid || isPaused) && (
          <button
            onClick={onEmergencyStop}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-lg shadow-rose-600/25 transition-all cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>EMERGENCY STOP (WEB)</span>
          </button>
        )}
      </div>

      {/* Main Interactive Visualizer Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        
        {/* Left Column: AIRO Chamber with Glowing Blue LED Strip & Translucent Galon */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          
          {/* Chamber Frame (Stainless Steel & LED Neon Accents) */}
          <div className="relative p-3 rounded-[36px] bg-gradient-to-b from-slate-100 via-sky-50 to-slate-200 border-4 border-slate-300 shadow-xl shadow-sky-900/10 flex flex-col items-center">
            
            {/* Left & Right Vertical Neon LED Strips (Like in AIRO machine) */}
            <div className="absolute top-6 bottom-6 left-1.5 w-1.5 rounded-full bg-cyan-400 led-strip-blue opacity-90" />
            <div className="absolute top-6 bottom-6 right-1.5 w-1.5 rounded-full bg-cyan-400 led-strip-blue opacity-90" />

            {/* Top Dispenser Nozzle / Faucet */}
            <div className="relative flex flex-col items-center mb-1">
              <div className="w-16 h-3 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 rounded-t-md shadow-inner border-t border-slate-300" />
              <div className="w-6 h-4 bg-slate-300 border-x border-slate-400 relative flex items-center justify-center">
                {isFilling && (
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
                )}
              </div>
              {/* Animated Pouring Water Stream Jet */}
              {isFilling && (
                <div className="w-2.5 h-8 bg-gradient-to-b from-white via-sky-300 to-cyan-400 animate-pulse shadow-[0_0_15px_rgba(56,189,248,1)] z-20 rounded-full" />
              )}
            </div>

            {/* Main 3D Translucent Blue Water Galon Tank */}
            <div className="relative w-52 h-68 bg-gradient-to-b from-sky-100/90 via-sky-200/80 to-blue-200/90 rounded-[28px] border-4 border-sky-400/70 p-2 shadow-inner flex flex-col justify-end overflow-hidden backdrop-blur-sm">
              
              {/* Glossy Glass Reflection Overlay */}
              <div className="absolute top-0 left-3 w-6 h-full bg-gradient-to-r from-white/40 to-transparent pointer-events-none z-30 rounded-l-2xl" />
              <div className="absolute top-0 right-3 w-3 h-full bg-gradient-to-l from-white/30 to-transparent pointer-events-none z-30 rounded-r-2xl" />

              {/* Scale Measurement Hash Lines */}
              <div className="absolute right-3 top-6 bottom-6 flex flex-col justify-between text-[10px] font-mono text-sky-800 z-20 pointer-events-none select-none font-bold">
                <span className="flex items-center gap-1"><span className="w-2.5 h-[1.5px] bg-sky-600 inline-block"/> {targetLiter || 19}L</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-[1px] bg-sky-500 inline-block"/> {((targetLiter || 19) * 0.75).toFixed(0)}L</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-[1.5px] bg-sky-600 inline-block"/> {((targetLiter || 19) * 0.5).toFixed(0)}L</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-[1px] bg-sky-500 inline-block"/> {((targetLiter || 19) * 0.25).toFixed(0)}L</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-[1.5px] bg-sky-600 inline-block"/> 0L</span>
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
                className="w-full water-fill-gradient rounded-2xl relative transition-all duration-700 ease-out flex items-center justify-center overflow-hidden"
                style={{ height: `${Math.max(percentage, isPaid ? 8 : 4)}%` }}
              >
                {/* Animated Wave Surface */}
                {isFilling && (
                  <div className="absolute -top-2 left-0 right-0 h-4 bg-white/60 rounded-full animate-wave" />
                )}
              </div>

              {/* Center Digital Display Badge */}
              <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none">
                <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl border-2 border-sky-300 shadow-xl flex flex-col items-center">
                  <div className="text-3xl font-black text-[#034078] font-mono tracking-tight">
                    {currentLiter.toFixed(1)} <span className="text-xs font-bold text-sky-600 font-sans">/ {targetLiter} L</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shadow-sm shadow-sky-400" />
                    <span className="text-[11px] font-black text-sky-800 font-mono tracking-wide">
                      {percentage}% TERISI
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Galon Base Plate (Stainless Steel Look) */}
            <div className="w-48 h-3 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 rounded-b-lg mt-1 border-b-2 border-slate-400" />
          </div>

          <div className="text-xs font-bold text-[#034078] mt-3 font-mono bg-sky-100 px-4 py-1 rounded-full border border-sky-300 shadow-sm flex items-center gap-1.5">
            <Droplet className="w-3.5 h-3.5 text-[#0284c7] fill-current" />
            <span>{systemState?.activeOrder?.title || 'Galon 19 Liter'}</span>
          </div>
        </div>

        {/* Right Column: Hardware Telemetry & Big Physical Button Control */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Active Order Card & Dynamic Colored Button */}
          {(systemState?.activeOrder || isPaid || isFilling || isPaused) ? (
            <div className={`p-5 rounded-3xl border-2 space-y-3.5 shadow-xl relative overflow-hidden transition-all duration-300 ${
              isFilling 
                ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-white border-emerald-400 shadow-emerald-500/15' 
                : 'bg-gradient-to-br from-rose-50 via-pink-50 to-white border-rose-300 shadow-rose-500/15'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  isFilling ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  <Sparkles className="w-3.5 h-3.5" /> Transaksi Sedang Berjalan
                </span>
                <span className="text-[11px] font-mono font-bold text-sky-900 bg-white px-2.5 py-0.5 rounded-lg border border-sky-200 shadow-sm">
                  {systemState?.activeOrder?.orderId || 'DANA-ACTIVE'}
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-0.5">
                <h3 className="text-lg font-black text-[#034078] tracking-tight">
                  {systemState?.activeOrder?.title || 'Isi Ulang Galon 19 Liter'}
                </h3>
                <span className="text-2xl font-black text-emerald-600 font-mono">
                  Rp {Number(systemState?.activeOrder?.amount || 7000).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="text-xs text-sky-900/80 font-medium flex items-center justify-between pt-2 border-t border-sky-200">
                <span>Pelanggan: <strong className="text-[#034078] font-bold">{systemState?.activeOrder?.customerName || 'Pelanggan Depot'}</strong></span>
                <span>Waktu Bayar: <strong className="text-[#0284c7] font-mono font-bold">{new Date(systemState?.activeOrder?.paidAt || Date.now()).toLocaleTimeString('id-ID')}</strong></span>
              </div>

              {/* TOMBOL WARNA DINAMIS: MERAH (SIAP/JEDA) <---> HIJAU (MENGUCUR) */}
              <div className="pt-2">
                {isFilling ? (
                  <button
                    type="button"
                    onClick={handleToggleWater}
                    disabled={isToggling}
                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.98] text-white font-black text-sm shadow-[0_0_30px_rgba(34,197,94,0.4)] ring-4 ring-emerald-300 border border-emerald-200 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-white animate-ping" />
                      <Pause className="w-5 h-5 fill-current" />
                      <span className="tracking-wide">🟢 TOMBOL HIJAU: AIR SEDANG MENGUCUR</span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-50">
                      Klik di sini atau Tekan Tombol D32 di ESP32 untuk JEDA (PAUSE)
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleToggleWater}
                    disabled={isToggling}
                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 active:scale-[0.98] text-white font-black text-sm shadow-[0_0_30px_rgba(239,68,68,0.4)] ring-4 ring-rose-400 border border-rose-300 animate-pulse flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-white" />
                      <Play className="w-5 h-5 fill-current" />
                      <span className="tracking-wide">
                        {isPaused ? '🔴 TOMBOL MERAH: AIR DIJEDA' : '🔴 TOMBOL MERAH: SUDAH BAYAR & SIAP'}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-rose-50">
                      Klik di sini atau Tekan Tombol D32 di ESP32 untuk {isPaused ? 'LANJUTKAN AIR' : 'MULAI KUCURKAN AIR'}
                    </span>
                  </button>
                )}

                <div className="flex items-center justify-between text-[11px] text-sky-800 font-semibold mt-2.5 px-1">
                  <span>💡 Lampu Tombol Fisik: <strong className="text-rose-600">D21 (Merah)</strong> • <strong className="text-emerald-600">D22 (Hijau)</strong></span>
                  <span>🔘 Tombol Push: <strong className="text-[#0284c7] font-mono">GPIO 32</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-sky-50/80 p-5 rounded-3xl border-2 border-dashed border-sky-300 text-center py-8">
              <p className="text-sm font-extrabold text-[#034078]">
                Depot dalam keadaan <span className="text-[#0284c7]">STANDBY (IDLE)</span>
              </p>
              <p className="text-xs text-sky-700 mt-1 font-medium">
                Pilih paket di panel kiosk atau scan QRIS DANA untuk memulai pengisian.
              </p>
            </div>
          )}

          {/* 3 Hardware HUD Cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* Card 1: Solenoid Valve */}
            <div className={`p-4 rounded-2xl border-2 transition-all bg-white shadow-sm ${
              isFilling 
                ? 'border-sky-400 bg-sky-50/50' 
                : 'border-sky-200'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-extrabold text-sky-900">Solenoid</span>
                <Zap className={`w-4 h-4 ${isFilling ? 'text-sky-500 animate-pulse' : 'text-slate-400'}`} />
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isFilling ? 'bg-sky-500 animate-ping' : 'bg-slate-300'}`} />
                <span className={`text-sm font-black font-mono tracking-wide ${isFilling ? 'text-[#0284c7]' : 'text-slate-500'}`}>
                  {isFilling ? 'TERBUKA' : 'TERTUTUP'}
                </span>
              </div>
              <span className="text-[10px] text-sky-600 font-mono mt-1 block">GPIO 26 (Relay)</span>
            </div>

            {/* Card 2: Flow Sensor */}
            <div className={`p-4 rounded-2xl border-2 transition-all bg-white shadow-sm ${
              isFilling 
                ? 'border-blue-400 bg-blue-50/50' 
                : 'border-sky-200'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-extrabold text-sky-900">Flow Sensor</span>
                <Gauge className={`w-4 h-4 ${isFilling ? 'text-blue-500 animate-spin' : 'text-slate-400'}`} />
              </div>
              <div className="text-sm font-black font-mono text-[#034078]">
                {telemetry?.flowRate ? telemetry.flowRate.toFixed(1) : (isFilling ? '4.8' : '0.0')} <span className="text-[10px] text-sky-600 font-normal">L/min</span>
              </div>
              <span className="text-[10px] text-sky-600 font-mono mt-1 block">GPIO 34 (YF-S201)</span>
            </div>

            {/* Card 3: Buzzer Alert */}
            <div className="p-4 rounded-2xl border-2 bg-white border-sky-200 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-extrabold text-sky-900">Audio Buzzer</span>
                <Volume2 className={`w-4 h-4 ${isFilling ? 'text-[#0284c7]' : 'text-slate-400'}`} />
              </div>
              <div className="text-sm font-black font-mono text-[#034078]">
                {isFilling ? '1x Mulai' : percentage >= 100 ? '4x Selesai' : 'Standby'}
              </div>
              <span className="text-[10px] text-sky-600 font-mono mt-1 block">GPIO 19</span>
            </div>
          </div>

          {/* Polling Health bar */}
          <div className="bg-white px-4 py-3 rounded-2xl border-2 border-sky-200 flex items-center justify-between text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${systemState?.esp32Status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-sky-900 font-semibold">
                Koneksi Polling ESP32: <strong className="text-[#0284c7] font-mono">/api/esp32/check-order</strong>
              </span>
            </div>
            <span className="text-sky-700 font-mono font-bold text-[11px]">
              IP: {systemState?.esp32Ip || 'Offline'}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
