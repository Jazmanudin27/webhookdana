# 🚰 Sistem Depot Air Isi Ulang Otomatis Terintegrasi Webhook DANA Sandbox & ESP32

Proyek lengkap solusi IoT otomatisasi pengisian air minum isi ulang menggunakan **ESP32**, **Solenoid Valve 12V**, **Water Flow Sensor (YF-S201)**, dan sistem pembayaran non-tunai **DANA Sandbox (Webhook OpenAPI)** dengan Dashboard Web Modern berbasis **Node.js, Express & React**.

---

## 📋 Daftar Isi
1. [Arsitektur & Diagram Alur](#-arsitektur--diagram-alur)
2. [Spesifikasi Fitur](#-spesifikasi-fitur)
3. [Daftar Endpoint API](#-daftar-endpoint-api)
4. [Skema Pinout ESP32 Hardware](#-skema-pinout-esp32-hardware)
5. [Panduan Instalasi & Menjalankan Proyek](#-panduan-instalasi--menjalankan-proyek)
6. [Panduan Domain & Tunneling (dana.aspartech.com)](#-panduan-domain--tunneling-danaaspartechcom)
7. [Konfigurasi Webhook di DANA Developer Sandbox](#-konfigurasi-webhook-di-dana-developer-sandbox)
8. [Panduan Firmware ESP32 (Arduino IDE)](#-panduan-firmware-esp32-arduino-ide)
9. [Pengujian & Simulasi Sistem](#-pengujian--simulasi-sistem)

---

## 🏗️ Arsitektur & Diagram Alur

```
[Pelanggan / Kiosk] 
       │
       ▼ Buat Pesanan (1 Galon 19L / Rp 7.000)
[Backend Server (Express)] ── Generates QRIS ──► [DANA Sandbox App / Simulator]
                                                           │
                                                           ▼ Bayar Sukses
[DANA Sandbox Gateway] ── POST /api/dana/finish-notify ──► [Backend Server]
                                                                 │ Set Status: "PAID"
                                                                 ▼
[ESP32 Device] ◄── GET /api/esp32/check-order (Tiap 2 dtk) ───────┘
       │
       ├─► 1. Buzzer BEEP 1x (GPIO 19)
       ├─► 2. Relay Solenoid ON / BUKA AIR (GPIO 26)
       ├─► 3. Hitung Liter via Flow Sensor (GPIO 18)
       │
       ▼ (Setelah 19 Liter Tercapai atau Tombol Stop Ditekan)
       ├─► 4. Relay Solenoid OFF / TUTUP AIR (GPIO 26)
       ├─► 5. Buzzer BEEP 4x Selesai (GPIO 19)
       │
       └─► POST /api/esp32/finish-fill ─────────────────────────► [Backend Server]
                                                                        │
                                                                  Reset ke IDLE
```

---

## ✨ Spesifikasi Fitur

### 1. Backend & Web Dashboard (Node.js, Express, React)
* **Webhook DANA Finish-Notify (`/api/dana/finish-notify`)**: Menerima callback resmi dari DANA Sandbox saat pembayaran selesai, otomatis memasukkan order ke antrean dispenser.
* **Order Generator (`/api/dana/create-order`)**: Mendukung pembuatan QRIS transaksi (Rp 7.000 untuk 1 Galon / 19 Liter, Rp 14.000 untuk 2 Galon / 38 Liter, dan custom).
* **ESP32 Polling Engine (`/api/esp32/check-order`)**: Endpoint ringan untuk ESP32 mengecek status antrean setiap 2 detik.
* **Refill Completion Callback (`/api/esp32/finish-fill`)**: Menerima laporan selesai dari ESP32 untuk mereset status sistem ke `IDLE`.
* **Dashboard Web Real-time**: Visualizer tangki air beranimasi, status katup solenoid, detak jantung ESP32 (Heartbeat), tombol simulasi pembayaran DANA, dan live JSON Webhook inspector.

### 2. Firmware ESP32 (Arduino IDE)
* **Koneksi WiFi & Auto-Reconnect**: Stabil dan otomatis menyambung kembali jika jaringan terputus.
* **Flow Metering Presisi (YF-S201)**: Perhitungan pulsa sensor air berbasis *Interrupt* (`IRAM_ATTR`).
* **Solenoid Relay Control**: Menyalakan dan mematikan valve secara instan.
* **Sinyal Audio Buzzer**:
  - `1x Beep Panjang`: Pembayaran terkonfirmasi & air mulai mengalir.
  - `4x Beep`: Air telah terisi penuh sesuai target liter.
  - `Alarm Cepat`: Tombol darurat ditekan (*Emergency Stop*).
* **Tombol Darurat Manual (GPIO 4)**: Menghentikan pengisian air seketika jika terjadi tumpah atau kendala fisik.

---

## 🌐 Daftar Endpoint API

| Metode | Endpoint | Deskripsi | Dipanggil Oleh |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/dana/finish-notify` | Webhook notifikasi pembayaran sukses | Gateway DANA Sandbox |
| `POST` | `/api/dana/create-order` | Membuat pesanan baru & QRIS | Web Kiosk / Pelanggan |
| `POST` | `/api/dana/simulate-pay` | Simulasi pembayaran 1-klik untuk testing | Web Dashboard |
| `GET` | `/api/esp32/check-order` | Polling status pesanan (`IDLE` / `PAID`) | ESP32 (tiap 2 dtk) |
| `POST` | `/api/esp32/finish-fill` | Laporan selesai isi air & reset IDLE | ESP32 |
| `POST` | `/api/esp32/telemetry` | Data live liter & pulsa real-time | ESP32 |
| `POST` | `/api/depot/emergency-stop`| Emergency stop manual | Web Dashboard |
| `GET` | `/api/status` | Status sistem & telemetry | Web Dashboard |
| `GET` | `/api/transactions` | Riwayat transaksi depot | Web Dashboard |
| `GET` | `/api/logs` | Log audit webhook & ESP32 | Web Dashboard |

---

## 🔌 Skema Pinout ESP32 Hardware

| Pin ESP32 | Komponen Hardware | Tipe Pin | Keterangan |
| :--- | :--- | :--- | :--- |
| **`GPIO 18`** | Water Flow Sensor (YF-S201) | Digital Input (Interrupt) | Kabel Kuning/Signal Sensor |
| **`GPIO 26`** | Relay Solenoid Valve 12V | Digital Output | Pin IN Relay (Active LOW) |
| **`GPIO 19`** | Active Buzzer 5V | Digital Output | Pin Positif (+) Buzzer |
| **`GPIO 4`** | Tombol Emergency Stop | Digital Input (Pull-Up) | Ke Push Button (Active LOW ke GND) |
| **`GPIO 2`** | LED Status Indikator | Digital Output | Built-in LED ESP32 |

---

## 🚀 Panduan Instalasi & Menjalankan Proyek

### 1. Prasyarat
* Node.js v18 atau v20+
* Arduino IDE (untuk upload firmware ESP32)

### 2. Langkah Instalasi Backend & Web

```bash
# 1. Masuk ke folder proyek
cd g:/WebhookDana

# 2. Install dependency backend
npm install

# 3. Build frontend React Dashboard
npm run build

# 4. Jalankan server
npm start
```
Server akan aktif di `http://localhost:3000`.

---

## 🌍 Panduan Domain & Tunneling (`dana.aspartech.com`)

DANA Sandbox memerlukan URL Webhook publik yang dapat diakses melalui internet via protokol HTTPS.

### Pilihan 1: Cloudflare Tunnel (Disarankan untuk Custom Domain `dana.aspartech.com`)
Jika domain `aspartech.com` menggunakan Cloudflare DNS:
```bash
# 1. Download Cloudflared CLI, lalu hubungkan tunnel:
cloudflared tunnel --url http://localhost:3000 --hostname dana.aspartech.com
```

### Pilihan 2: Localtunnel dengan Subdomain
```bash
npx localtunnel --port 3000 --subdomain dana-depot-aspartech
# Akan menghasilkan URL HTTPS: https://dana-depot-aspartech.loca.lt
```

### Pilihan 3: Ngrok
```bash
ngrok http 3000 --domain=dana.aspartech.com
# atau ngrok standar:
ngrok http 3000
```

> **Update `.env`**: Setelah tunnel aktif, pastikan variabel `PUBLIC_BASE_URL` di file `.env` diisi dengan domain Anda:
> ```env
> PUBLIC_BASE_URL=https://dana.aspartech.com
> ```

---

## 💳 Konfigurasi Webhook di DANA Developer Sandbox

1. Login ke **[DANA Developer Portal](https://dashboard.sandbox.dana.id/)**.
2. Masuk ke menu **Settings / Notification URL / Webhook Configuration**.
3. Daftarkan URL Webhook:
   * **Finish Notify URL**: `https://dana.aspartech.com/api/dana/finish-notify`
4. Pilih event notifikasi: `Payment Success / Acquirement Finish Notify`.
5. Simpan pengaturan.

---

## 💻 Panduan Firmware ESP32 (Arduino IDE)

1. Buka file **`esp32/DepotAir_ESP32.ino`** di Arduino IDE.
2. Buka **Tools > Manage Libraries**, lalu cari dan install library **`ArduinoJson`** (Versi 6.x atau 7.x).
3. Sesuaikan konfigurasi WiFi & URL di bagian atas sketch:
   ```cpp
   const char* WIFI_SSID     = "NAMA_WIFI_ANDA";
   const char* WIFI_PASSWORD = "PASSWORD_WIFI_ANDA";
   
   // URL Domain Backend
   const char* BASE_SERVER_URL = "https://dana.aspartech.com";
   ```
4. Hubungkan board ESP32 ke PC melalui kabel USB.
5. Pilih **Tools > Board > ESP32 Arduino > ESP32 Dev Module**.
6. Pilih **Port COM** yang sesuai.
7. Klik tombol **Upload**.
8. Buka **Serial Monitor** (Baudrate: `115200`) untuk melihat log sistem.

---

## 🧪 Pengujian & Simulasi Sistem

### Cara 1: Menggunakan Dashboard Web (Paling Mudah)
1. Buka browser ke `http://localhost:3000` (atau `https://dana.aspartech.com`).
2. Pilih paket **1 Galon (19L) - Rp 7.000** dan klik **Generate Order**.
3. Klik tombol hijau **⚡ Simulasi Pembayaran Sukses**.
4. Lihat Solenoid Valve membuka dan air mengisi di grafik galon!

### Cara 2: Simulasi ESP32 di Terminal (Tanpa Perlu Hardware)
Jika Anda belum memasang hardware ESP32 fisik, Anda dapat menjalankan simulator virtual ESP32 di terminal:
```bash
# Di terminal baru:
npm run test:esp32
```
Simulator ini akan otomatis memantau pesanan, membuka katup simulasi, menghitung pulsa air, dan mengirim notifikasi selesai ke server.

### Cara 3: Uji Webhook DANA Langsung via Script
```bash
npm run test:webhook
```

---

## 🛡️ Lisensi & Pengembang
Dibuat oleh **AsparTech** untuk otomatisasi depot air minum isi ulang modern berbasis IoT dan payment gateway DANA.
