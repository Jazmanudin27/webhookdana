import React, { useState, useEffect } from 'react';
import { Droplet, Activity, Zap, ShieldAlert, CheckCircle2, RotateCw, Volume2 } from 'lucide-react';

export default function WaterDispenserVisualizer({ systemState, telemetry, onEmergencyStop }) {
  const isPaid = systemState?.status === 'PAID';
  const isFilling = systemState?.status === 'FILLING';
  const isIdle = systemState?.status === 'IDLE';

  const targetLiter = systemState?.activeOrder?.targetLiter || (isPaid ? 19 : 0);
  const currentLiter = telemetry?.currentLiter || 0;
  
  // Calculate percentage
  const percentage = targetLiter > 0 
    ? Math.min(100, Math.round((currentLiter / targetLiter) * 100))
    : (isPaid ? 5 : 0);

  return (
    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden border border-slate-800">
      {/* Background ambient glow */}
      <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
        isFilling ? 'bg-cyan-500/20' : isPaid ? 'bg-emerald-500/15' : 'bg-blue-600/10'
      }`} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl transition-all duration-500 ${
            isFilling 
              ? 'bg-cyan-500/20 text-cyan-400 ring-2 ring-cyan-500/40 animate-pulse' 
              : isPaid 
              ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40' 
              : 'bg-slate-800 text-slate-400'
          }`}>
            <Droplet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Status Dispenser Depot
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                isFilling 
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse' 
                  : isPaid 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {systemState?.status || 'IDLE'}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitoring real-time Solenoid Valve (GPIO 26) & Flow Sensor (GPIO 18)
            </p>
          </div>
        </div>

        {/* Emergency Stop Button */}
        {(isFilling || isPaid) && (
          <button
            onClick={onEmergencyStop}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold rounded-xl text-sm shadow-lg shadow-rose-600/25 transition-all duration-200 animate-bounce"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Emergency Stop (Web)</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Animated Water Tank Graphic */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-48 h-64 bg-slate-900/90 rounded-3xl border-4 border-slate-700 p-2 shadow-2xl flex flex-col justify-end overflow-hidden">
            {/* Galon Cap Top */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-700 rounded-t-lg border-2 border-slate-600" />

            {/* Measurement Graduations */}
            <div className="absolute right-2 top-4 bottom-4 flex flex-col justify-between text-[10px] font-mono text-slate-500 z-20 pointer-events-none">
              <span>{targetLiter || 19}L</span>
              <span>{Math.round((targetLiter || 19) * 0.75)}L</span>
              <span>{Math.round((targetLiter || 19) * 0.5)}L</span>
              <span>{Math.round((targetLiter || 19) * 0.25)}L</span>
              <span>0L</span>
            </div>

            {/* Water Stream when filling */}
            {isFilling && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-full bg-cyan-300/80 blur-[1px] animate-pulse z-10" />
            )}

            {/* Water Body Liquid */}
            <div 
              className="w-full water-gradient rounded-2xl relative transition-all duration-500 ease-out flex items-center justify-center overflow-hidden shadow-inner"
              style={{ height: `${Math.max(percentage, isPaid ? 8 : 4)}%` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 water-shimmer opacity-40 pointer-events-none" />
              
              {/* Wave surface */}
              {isFilling && (
                <div className="absolute -top-3 left-0 right-0 h-4 bg-cyan-200/40 rounded-full animate-wave" />
              )}
            </div>

            {/* Center Percentage Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
              <span className="text-3xl font-extrabold text-white drop-shadow-md font-mono">
                {currentLiter.toFixed(1)} <span className="text-sm font-normal text-cyan-200">/ {targetLiter} L</span>
              </span>
              <span className="text-xs font-semibold text-cyan-100/90 bg-slate-900/80 px-2 py-0.5 rounded-full mt-1">
                {percentage}% Terisi
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-3 font-mono">
            {systemState?.activeOrder?.title || 'Galon 19 Liter'}
          </p>
        </div>

        {/* Hardware Status Gauges & Details */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Order Banner */}
          {systemState?.activeOrder ? (
            <div className="bg-slate-900/90 p-4 rounded-xl border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                  Transaksi Sedang Diproses
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {systemState.activeOrder.orderId}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-bold text-white">
                  {systemState.activeOrder.title}
                </h3>
                <span className="text-xl font-extrabold text-emerald-400 font-mono">
                  Rp {systemState.activeOrder.amount.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>Pelanggan: <strong className="text-slate-200">{systemState.activeOrder.customerName}</strong></span>
                <span>•</span>
                <span>Dibayar: <strong className="text-slate-200">{new Date(systemState.activeOrder.paidAt || Date.now()).toLocaleTimeString('id-ID')}</strong></span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 text-center py-6">
              <p className="text-sm text-slate-400">
                Depot dalam keadaan <strong className="text-slate-200">IDLE</strong>. Menunggu pembayaran DANA baru.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Gunakan panel di sebelah kanan untuk simulasi transaksi & QRIS.
              </p>
            </div>
          )}

          {/* 3 Hardware Gauges */}
          <div className="grid grid-cols-3 gap-3">
            {/* Gauge 1: Solenoid Valve */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              isFilling 
                ? 'bg-cyan-950/40 border-cyan-500/50 shadow-lg shadow-cyan-950/50' 
                : 'bg-slate-900/60 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-slate-400">Solenoid Valve</span>
                <Zap className={`w-3.5 h-3.5 ${isFilling ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isFilling ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
                <span className={`text-sm font-bold font-mono ${isFilling ? 'text-cyan-300' : 'text-slate-400'}`}>
                  {isFilling ? 'TERBUKA' : 'TERTUTUP'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">GPIO 26 (Relay)</span>
            </div>

            {/* Gauge 2: Flow Sensor */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              isFilling 
                ? 'bg-blue-950/40 border-blue-500/50' 
                : 'bg-slate-900/60 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-slate-400">Flow Sensor</span>
                <Activity className={`w-3.5 h-3.5 ${isFilling ? 'text-blue-400 animate-spin' : 'text-slate-600'}`} />
              </div>
              <div className="text-sm font-bold font-mono text-white">
                {telemetry?.pulses || 0} <span className="text-[11px] text-slate-400 font-normal">pulsa</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">GPIO 18 (YF-S201)</span>
            </div>

            {/* Gauge 3: Buzzer Alert */}
            <div className="p-3.5 rounded-xl border bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-slate-400">Buzzer Alert</span>
                <Volume2 className={`w-3.5 h-3.5 ${isFilling ? 'text-emerald-400' : 'text-slate-600'}`} />
              </div>
              <div className="text-sm font-bold font-mono text-slate-300">
                {isFilling ? '1x Start' : percentage >= 100 ? '4x Selesai' : 'Standby'}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">GPIO 19</span>
            </div>
          </div>

          {/* ESP32 Communication Status */}
          <div className="flex items-center justify-between bg-slate-950/60 px-4 py-2.5 rounded-xl border border-slate-800/80 text-xs">
            <span className="text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Polling ESP32 HTTP: <strong>/api/esp32/check-order</strong> (2s interval)
            </span>
            <span className="text-slate-400 font-mono">
              IP: {systemState?.esp32Ip || 'Belum Terhubung'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
