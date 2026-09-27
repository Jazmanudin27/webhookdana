/*
  ===========================================================================================
  PROYEK   : DEPOT AIR ISI ULANG OTOMATIS - DANA.ASPARTECH.COM
  HARDWARE : ESP32 Dev Module (WROOM-32)
  PINOUT   : 
    - GPIO 34 : Water Flow Sensor YF-S201 (Kabel Sinyal Kuning)
    - GPIO 26 : Relay Solenoid Valve 12V (IN Relay - Active LOW)
    - GPIO 32 : Tombol Kucur Air / Jeda (Push Button ke GND)
    - GPIO 21 : Lampu LED Merah Tombol (Menyala saat Siap/Bayar & saat Dijeda)
    - GPIO 22 : Lampu LED Hijau Tombol (Menyala saat Air Mengucur)
    - GPIO 19 : Active Buzzer 5V
    - GPIO 2  : Built-in Blue LED ESP32
  ===========================================================================================
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WebServer.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

Preferences preferences;
WiFiClientSecure secureClient;

// ==========================================================
// 1. DEFAULT KONFIGURASI WIFI, ID MESIN & SERVER CLOUD
// ==========================================================
// ID Unik Mesin Depot (Bisa diubah lewat Hotspot HP di lapangan atau default di sini)
String DEVICE_ID = "DEPOT-001";

String wifi_ssid     = "Ade";          // SSID WiFi Router
String wifi_password = "19052026";     // Password WiFi Router

const char* BASE_SERVER_URL = "https://dana.aspartech.com";

// Endpoint API
String urlCheckOrder = String(BASE_SERVER_URL) + "/api/esp32/check-order";
String urlFinishFill = String(BASE_SERVER_URL) + "/api/esp32/finish-fill";

// Hotspot Darurat jika WiFi gagal connect
const char* AP_SSID = "ESP32_Depot_Air";
const char* AP_PASS = "12345678";
WebServer apServer(80);
bool isApMode = false;
bool shouldRestart = false;
unsigned long restartTimer = 0;

// ==========================================================
// 2. PENETAPAN PIN ESP32
// ==========================================================
const int RELAY_PIN       = 26; // Relay Solenoid Valve 12V (D26)
const int BLUE_LED_PIN    = 2;  // LED Indikator Built-in (D2)
const int BUTTON_STOP_PIN = 32; // Tombol Kucur Air / Jeda (D32)
const int FLOW_SENSOR_PIN = 34; // Sinyal Kuning Sensor Flow YF-S201 (D34)
const int BUZZER_PIN      = 19; // Buzzer 5V (D19)
const int LED_RED_PIN     = 21; // LED Merah (D21) - Warna Tombol Siap / Dijeda
const int LED_GREEN_PIN   = 22; // LED Hijau (D22) - Warna Tombol Mengucur

// Logika Relay (Active LOW)
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

// ==========================================================
// 3. VARIABEL FLOW SENSOR & SISTEM
// ==========================================================
bool isWaitingButton = false; // Order DANA sudah lunas, menunggu pembeli menekan tombol untuk kucurkan air
bool isFilling       = false; // Air sedang mengucur (Solenoid ON)
bool isPaused        = false; // Pengisian dijeda sementara (Solenoid OFF)

unsigned long currentFillMl = 0;
unsigned long targetFillMl  = 0;
unsigned long totalAccumulatedMl = 0;
String currentOrderId = "";

// Timeout Otomatis saat Jeda (60 Detik)
unsigned long pauseStartTime = 0;
const unsigned long PAUSE_TIMEOUT_MS = 60000; // 60 detik batas jeda

volatile byte pulseCount = 0;
float flowRate = 0.0;
unsigned long oldTime = 0;
const float calibrationFactor = 7.5; // YF-S201

unsigned long lastPollTime = 0;
const unsigned long POLL_INTERVAL = 1500; // Polling setiap 1.5 detik

// Hardware Interrupt & Debounce untuk Tombol D32
volatile bool buttonPressedFlag = false;
volatile unsigned long lastButtonInterruptTime = 0;

void IRAM_ATTR buttonISR() {
    unsigned long now = millis();
    if (now - lastButtonInterruptTime > 600) {
        buttonPressedFlag = true;
        lastButtonInterruptTime = now;
    }
}

void IRAM_ATTR pulseCounter() {
    pulseCount++;
}

void triggerBuzzer(int beepCount, int durationMs = 80, int pauseMs = 80) {
    for (int i = 0; i < beepCount; i++) {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(durationMs);
        digitalWrite(BUZZER_PIN, LOW);
        if (i < beepCount - 1) delay(pauseMs);
    }
}

// Mengatur Lampu Tombol: Merah (Siap/Jeda) vs Hijau (Mengucur)
void updateLeds() {
    if (isWaitingButton || (isFilling && isPaused)) {
        // Status SIAP / JEDA -> 🔴 TOMBOL WARNA MERAH!
        digitalWrite(LED_RED_PIN, HIGH);
        digitalWrite(LED_GREEN_PIN, LOW);
        digitalWrite(BLUE_LED_PIN, (millis() / 300) % 2 == 0 ? HIGH : LOW);
    } else if (isFilling && !isPaused) {
        // Status MENGUCUR -> 🟢 TOMBOL WARNA HIJAU!
        digitalWrite(LED_RED_PIN, LOW);
        digitalWrite(LED_GREEN_PIN, HIGH);
        digitalWrite(BLUE_LED_PIN, HIGH);
    } else {
        // Standby normal (Belum ada order)
        digitalWrite(LED_RED_PIN, LOW);
        digitalWrite(LED_GREEN_PIN, LOW);
        digitalWrite(BLUE_LED_PIN, WiFi.status() == WL_CONNECTED ? HIGH : LOW);
    }
}

// ==========================================================
// 4. MEMUAT & MENYIMPAN KONFIGURASI (WIFI & DEVICE ID) DARI NVS
// ==========================================================
void loadStoredConfig() {
    preferences.begin("depot_wifi", false);
    String storedSSID = preferences.getString("ssid", "");
    String storedPASS = preferences.getString("pass", "");
    String storedDev  = preferences.getString("dev_id", "");
    preferences.end();

    if (storedSSID.length() > 0 && storedPASS.length() > 0) {
        wifi_ssid = storedSSID;
        wifi_password = storedPASS;
        Serial.print("📂 Membaca WiFi dari memori NVS ESP32: ");
        Serial.println(wifi_ssid);
    } else {
        Serial.println("ℹ️ Memakai konfigurasi default WiFi: " + wifi_ssid);
    }

    if (storedDev.length() > 0) {
        DEVICE_ID = storedDev;
        Serial.println("🏭 [NVS] Membaca Device ID dari Flash: " + DEVICE_ID);
    } else {
        Serial.println("ℹ️ Memakai Device ID default: " + DEVICE_ID);
    }
}

void saveConfigToNVS(String newSsid, String newPass, String newDevId = "") {
    preferences.begin("depot_wifi", false);
    preferences.putString("ssid", newSsid);
    preferences.putString("pass", newPass);
    if (newDevId.length() > 0) {
        newDevId.trim();
        newDevId.toUpperCase();
        preferences.putString("dev_id", newDevId);
        DEVICE_ID = newDevId;
    }
    preferences.end();
    
    wifi_ssid = newSsid;
    wifi_password = newPass;

    Serial.println("\n💾 [NVS] Konfigurasi berhasil disimpan permanen ke memori Flash ESP32!");
    Serial.print("SSID Baru: "); Serial.println(newSsid);
    Serial.print("Device ID: "); Serial.println(DEVICE_ID);
}

void saveWiFiToNVS(String newSsid, String newPass) {
    saveConfigToNVS(newSsid, newPass, "");
}

// ==========================================================
// 5. KONEKSI KE WIFI
// ==========================================================
bool connectToWiFi(int timeoutSeconds = 15) {
    Serial.println("\n-------------------------------------------------");
    Serial.print("[WIFI] Target SSID     : "); Serial.println(wifi_ssid);
    Serial.print("[WIFI] Target Password : "); Serial.println(wifi_password);
    Serial.println("-------------------------------------------------");
    Serial.flush();

    WiFi.persistent(false);
    WiFi.disconnect(true, true);
    delay(200);
    
    WiFi.mode(WIFI_STA);
    delay(200);

    WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());

    unsigned long startAttemptTime = millis();

    while (WiFi.status() != WL_CONNECTED && (millis() - startAttemptTime < (unsigned long)timeoutSeconds * 1000)) {
        delay(250);
        yield();
        Serial.print(".");
        Serial.flush();
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WIFI] SUKSES TERHUBUNG!");
        Serial.print("[WIFI] IP Address ESP32: "); Serial.println(WiFi.localIP());
        Serial.print("[WIFI] Sinyal RSSI     : "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
        
        digitalWrite(BLUE_LED_PIN, HIGH);
        triggerBuzzer(2, 80, 80);
        isApMode = false;
        return true;
    } else {
        Serial.println("\n[WIFI] Gagal terhubung!");
        digitalWrite(BLUE_LED_PIN, LOW);
        return false;
    }
}

// ==========================================================
// 6. HOTSPOT DARURAT / CAPTIVE PORTAL
// ==========================================================
void startEmergencyAP() {
    isApMode = true;
    WiFi.disconnect(true);
    delay(100);
    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASS);

    Serial.println("\n⚠️ [MODE DARURAT] Membuka Hotspot Konfigurasi WiFi:");
    Serial.print("SSID Hotspot: "); Serial.println(AP_SSID);
    Serial.print("Password    : "); Serial.println(AP_PASS);
    Serial.print("Buka browser di HP ke: http://"); Serial.println(WiFi.softAPIP());

    apServer.on("/", []() {
        String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'><title>Pengaturan Depot Air</title>"
                      "<style>body{font-family:sans-serif;background:#0f172a;color:#fff;padding:20px;text-align:center;}"
                      ".card{background:#1e293b;padding:24px;border-radius:16px;max-width:350px;margin:auto;text-align:left;}"
                      "h2{text-align:center;color:#38bdf8;margin-bottom:4px;}"
                      "p.sub{font-size:12px;color:#94a3b8;text-align:center;margin-bottom:20px;}"
                      "label{font-size:11px;color:#cbd5e1;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-top:10px;}"
                      "input{width:100%;padding:10px;margin:6px 0 10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff;box-sizing:border-box;font-size:14px;}"
                      "button{background:#0284c7;color:#fff;border:none;padding:12px;width:100%;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:14px;font-size:15px;}</style></head>"
                      "<body><div class='card'><h2>Setup Depot Air</h2><p class='sub'>Konfigurasi WiFi & Device ID Cabang</p>"
                      "<form action='/save' method='POST'>"
                      "<label>Nama WiFi (SSID):</label>"
                      "<input type='text' name='ssid' value='" + wifi_ssid + "' required>"
                      "<label>Password WiFi:</label>"
                      "<input type='password' name='pass' placeholder='Password WiFi'>"
                      "<label>Device ID Cabang (Unik):</label>"
                      "<input type='text' name='device_id' value='" + DEVICE_ID + "' required style='color:#38bdf8;font-weight:bold;text-transform:uppercase;'>"
                      "<button type='submit'>Simpan & Sambungkan</button></form></div></body></html>";
        apServer.send(200, "text/html", html);
    });

    apServer.on("/save", []() {
        if (apServer.hasArg("ssid")) {
            String s = apServer.arg("ssid");
            String p = apServer.hasArg("pass") ? apServer.arg("pass") : "";
            String d = apServer.hasArg("device_id") ? apServer.arg("device_id") : DEVICE_ID;
            d.trim();
            d.toUpperCase();
            saveConfigToNVS(s, p, d);

            String resp = "<html><body style='background:#0f172a;color:#fff;text-align:center;padding:40px;font-family:sans-serif;'>"
                          "<h2 style='color:#38bdf8;'>✅ Konfigurasi Tersimpan!</h2>"
                          "<p>Device ID: <strong>" + d + "</strong></p>"
                          "<p>WiFi: <strong>" + s + "</strong></p>"
                          "<p style='color:#94a3b8;'>ESP32 sedang me-restart untuk konek ke server...</p></body></html>";
            apServer.send(200, "text/html", resp);
            
            shouldRestart = true;
            restartTimer = millis();
        }
    });

    apServer.begin();
}

// ==========================================================
// 7. KONTROL TRANSAKSI & PENGISIAN AIR
// ==========================================================

// Menyiapkan order setelah DANA Sandbox dibayar (status: PAID)
void prepareOrder(String orderId, float targetLiters) {
    currentOrderId = orderId;
    targetFillMl = (unsigned long)(targetLiters * 1000.0);
    currentFillMl = 0;
    isWaitingButton = true;
    isFilling = false;
    isPaused = false;
    
    // Pastikan solenoid tertutup rapat sebelum tombol ditekan
    digitalWrite(RELAY_PIN, RELAY_OFF);
    updateLeds(); // 🔴 Tombol berubah jadi MERAH (Siap & Bayar)
    
    Serial.println("\n========================================================");
    Serial.println("📢 [PEMBAYARAN DANA BERHASIL DITERIMA]");
    Serial.printf("📦 Order ID   : %s\n", orderId.c_str());
    Serial.printf("🚰 Target Air : %.2f Liter\n", targetLiters);
    Serial.println("🔴 TOMBOL MERAH MENYALA (D21) -> Siap & Bayar");
    Serial.println("👉 Letakkan galon, lalu TEKAN TOMBOL (D32) untuk MULAI!");
    Serial.println("========================================================");
    
    triggerBuzzer(2, 120, 80);
}

void notifyServerFinished(bool isFinishedSuccess) {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    http.begin(secureClient, urlFinishFill);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(3000);

    StaticJsonDocument<256> doc;
    doc["deviceId"]        = DEVICE_ID;
    doc["orderId"]         = currentOrderId;
    doc["dispensedLiter"]  = (float)currentFillMl / 1000.0;
    doc["status"]          = isFinishedSuccess ? "COMPLETED" : "EMERGENCY_STOP";

    String jsonBody;
    serializeJson(doc, jsonBody);

    http.POST(jsonBody);
    http.end();
}

void stopFilling(bool isFinishedSuccess = true) {
    isFilling = false;
    isWaitingButton = false;
    isPaused = false;
    pauseStartTime = 0;
    
    digitalWrite(RELAY_PIN, RELAY_OFF);
    updateLeds(); // Matikan LED tombol (Standby)
    
    if (isFinishedSuccess) {
        Serial.println("\n🎉🎉🎉 [PENGISIAN AIR SELESAI OTOMATIS!] 🎉🎉🎉");
        Serial.printf("✅ Total Terisi : %.2f Liter\n", (float)currentFillMl / 1000.0);
        Serial.println("Keran telah ditutup rapat. Lampu tombol mati. Selesai!");
        triggerBuzzer(4, 150, 100);
        notifyServerFinished(true);
    } else {
        Serial.println("\n🚨 [PENGISIAN DIHENTIKAN MANUAL / EMERGENCY]");
        triggerBuzzer(2, 350, 100);
        notifyServerFinished(false);
    }

    currentOrderId = "";
    targetFillMl = 0;
    currentFillMl = 0;
}

// Handler Tombol (D32 & Perintah Web):
// 1. Bayar/Siap -> Tekan -> Buka Keran & 🟢 HIJAU
// 2. Mengalir   -> Tekan -> Tutup Keran (Jeda) & 🔴 MERAH
// 3. Jeda       -> Tekan -> Buka Keran (Lanjut) & 🟢 HIJAU
void handleButtonPress() {
    unsigned long now = millis();
    static unsigned long lastActionTime = 0;

    // Cooldown 600ms untuk mencegah bouncing mekanis tombol atau dobel klik tidak sengaja
    if (now - lastActionTime < 600) {
        Serial.println("⚠️ [ANTI-BOUNCE] Dobel klik dicegah (cooldown 600ms aktif).");
        return;
    }
    lastActionTime = now;
    lastButtonInterruptTime = now;

    Serial.println("\n🔘 [AKSI TOMBOL TERDETEKSI!]");

    // 1. Menunggu Pembeli Mulai (Status PAID / Ready):
    if (isWaitingButton) {
        isWaitingButton = false;
        isFilling = true;
        isPaused = false;
        
        digitalWrite(RELAY_PIN, RELAY_ON); // Buka Solenoid Valve!
        updateLeds(); // 🟢 TOMBOL BERUBAH JADI HIJAU!

        Serial.println("🟢 --> KERAN DIBUKA! Air mulai mengucur (Lampu Hijau D22 ON)...");
        triggerBuzzer(1, 150);
        lastPollTime = millis() - 1000; // Sinkronkan ke server 500ms lagi
        return;
    }

    // 2. Air sedang mengalir -> Pembeli mau JEDA (PAUSE):
    if (isFilling && !isPaused) {
        isPaused = true;
        pauseStartTime = millis(); // Mulai hitung mundur 60 detik batas jeda
        digitalWrite(RELAY_PIN, RELAY_OFF); // Tutup Solenoid Valve sementara
        updateLeds(); // 🔴 TOMBOL BERUBAH JADI MERAH LAGI!

        Serial.println("🔴 --> PENGISIAN DIJEDA (PAUSE). Keran ditutup (Lampu Merah D21 ON)...");
        Serial.printf("   Terisi saat ini: %.2f / %.2f Liter\n", (float)currentFillMl / 1000.0, (float)targetFillMl / 1000.0);
        Serial.println("   ⏰ Batas waktu jeda: 60 detik. Transaksi otomatis ditutup jika tidak dilanjutkan.");
        triggerBuzzer(2, 70, 60);
        lastPollTime = millis() - 1000; // Sinkronkan ke server 500ms lagi
        return;
    }

    // 3. Sedang Jeda -> Pembeli mau LANJUTKAN (RESUME):
    if (isFilling && isPaused) {
        isPaused = false;
        pauseStartTime = 0; // Reset timer jeda
        digitalWrite(RELAY_PIN, RELAY_ON); // Buka Solenoid Valve lagi!
        updateLeds(); // 🟢 TOMBOL BERUBAH JADI HIJAU LAGI!

        Serial.println("🟢 --> MELANJUTKAN PENGISIAN AIR! Keran dibuka lagi (Lampu Hijau D22 ON)...");
        triggerBuzzer(1, 150);
        lastPollTime = millis() - 1000; // Sinkronkan ke server 500ms lagi
        return;
    }

    // 4. Standby normal (Belum ada order DANA):
    Serial.println("ℹ️ Tombol D32 berfungsi normal (Standby - silakan bayar via DANA terlebih dahulu).");
    digitalWrite(BLUE_LED_PIN, HIGH);
    delay(100);
    digitalWrite(BLUE_LED_PIN, LOW);
}

// ==========================================================
// 8. UNIFIED POLLING & TELEMETRY (1 KONEKSI RINGAN, TIDAK PERNAH OFFLINE)
// ==========================================================
void checkOrderFromServer() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("⚠️ WiFi terputus, mencoba koneksi ulang...");
        WiFi.reconnect();
        return;
    }

    // Tentukan status saat ini untuk dikirim ke server
    String stateStr = "IDLE";
    if (isWaitingButton) {
        stateStr = "WAITING";
    } else if (isFilling && isPaused) {
        stateStr = "PAUSED";
    } else if (isFilling && !isPaused) {
        stateStr = "FILLING";
    }

    unsigned long pauseRemainingSec = 0;
    if (isFilling && isPaused && pauseStartTime > 0) {
        unsigned long elapsed = millis() - pauseStartTime;
        if (elapsed < PAUSE_TIMEOUT_MS) {
            pauseRemainingSec = (PAUSE_TIMEOUT_MS - elapsed) / 1000;
        }
    }

    // Kirim telemetry + polling perintah sekaligus dalam 1 request cepat
    String url = urlCheckOrder + "?deviceId=" + DEVICE_ID +
                 "&ssid=" + wifi_ssid + 
                 "&state=" + stateStr + 
                 "&currentLiter=" + String((float)currentFillMl / 1000.0, 2) + 
                 "&flowRate=" + String(flowRate, 1) +
                 "&pauseRemaining=" + String(pauseRemainingSec);

    if (currentOrderId.length() > 0) {
        url += "&orderId=" + currentOrderId;
    }

    HTTPClient http;
    http.begin(secureClient, url);
    http.setTimeout(2500); // 2.5 detik max agar tidak pernah hang

    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (!error) {
            const char* status = doc["status"];
            
            // Perintah ganti WiFi dari Web Dashboard
            if (status && strcmp(status, "UPDATE_WIFI") == 0) {
                String newSsid = doc["wifiSsid"].as<String>();
                String newPass = doc["wifiPassword"].as<String>();

                Serial.println("\n⚡ [OTA CLOUD] Menerima Perintah Ganti WiFi dari Website!");
                triggerBuzzer(3, 100, 100);
                saveWiFiToNVS(newSsid, newPass);

                if (connectToWiFi(15)) {
                    Serial.println("🎉 Berhasil beralih ke WiFi baru!");
                } else {
                    startEmergencyAP();
                }
                http.end();
                return;
            }

            // Perintah MULAI / LANJUT dari Web
            if (status && (strcmp(status, "START") == 0 || strcmp(status, "RESUME") == 0)) {
                if (isWaitingButton || (isFilling && isPaused)) {
                    Serial.println("🌐 [WEB KLIK] Tombol Kucur Air ditekan dari Dashboard!");
                    handleButtonPress();
                }
            } 
            // Perintah JEDA dari Web
            else if (status && strcmp(status, "PAUSE") == 0) {
                if (isFilling && !isPaused) {
                    Serial.println("🌐 [WEB KLIK] Tombol Jeda ditekan dari Dashboard!");
                    handleButtonPress();
                }
            } 
            // Order DANA Baru Saja Lunas
            else if (status && strcmp(status, "PAID") == 0) {
                String orderId = doc["orderId"].as<String>();
                float targetLiters = doc["targetLiter"].as<float>();

                if (orderId != currentOrderId) {
                    prepareOrder(orderId, targetLiters);
                }
            } 
            // Perintah Darurat Berhenti dari Web
            else if (status && (strcmp(status, "IDLE") == 0 || strcmp(status, "EMERGENCY_STOP") == 0 || strcmp(status, "STOP") == 0)) {
                if (isFilling || isWaitingButton) {
                    Serial.println("\n🛑 [WEB EMERGENCY STOP] Pembatalan diterima dari Website!");
                    stopFilling(false);
                }
            }
        }
    }
    http.end();
}

// ==========================================================
// 9. SETUP
// ==========================================================
void setup() {
    // Matikan brownout detector agar tidak reset saat lonjakan arus WiFi
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); 

    Serial.begin(115200);
    delay(800);

    Serial.println("\n=================================================");
    Serial.println("💧 ESP32 DEPOT AIR OTOMATIS - DANA.ASPARTECH.COM");
    Serial.println("🏭 ID MESIN / CABANG : " + DEVICE_ID);
    Serial.println("=================================================");

    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, RELAY_OFF);

    pinMode(BLUE_LED_PIN, OUTPUT);
    digitalWrite(BLUE_LED_PIN, LOW);

    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);

    pinMode(LED_RED_PIN, OUTPUT);
    digitalWrite(LED_RED_PIN, LOW);

    pinMode(LED_GREEN_PIN, OUTPUT);
    digitalWrite(LED_GREEN_PIN, LOW);

    secureClient.setInsecure();

    loadStoredConfig();

    if (!connectToWiFi(15)) {
        startEmergencyAP();
    }

    // Tombol D32: INPUT_PULLUP + Hardware Interrupt (FALLING ke GND)
    pinMode(BUTTON_STOP_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(BUTTON_STOP_PIN), buttonISR, FALLING);

    pinMode(FLOW_SENSOR_PIN, INPUT);
    attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), pulseCounter, FALLING);

    updateLeds();
}

// ==========================================================
// 10. LOOP UTAMA
// ==========================================================
void loop() {
    if (shouldRestart && (millis() - restartTimer >= 1000)) {
        ESP.restart();
    }

    if (isApMode) {
        apServer.handleClient();
        return;
    }

    // 1. Deteksi Tombol D32 (Hardware Interrupt + Cooldown 600ms Anti Dobel Klik)
    if (buttonPressedFlag) {
        buttonPressedFlag = false;
        handleButtonPress();
    }

    // 2. Deteksi Batas Waktu Jeda (Auto-Timeout 60 Detik Otomatis Tutup Transaksi)
    if (isFilling && isPaused && pauseStartTime > 0) {
        if (millis() - pauseStartTime >= PAUSE_TIMEOUT_MS) {
            Serial.println("\n⏰⏰⏰ [AUTO-TIMEOUT JEDA 60 DETIK AKTIF!] ⏰⏰⏰");
            Serial.printf("ℹ️ Pengisian dijeda > 60 detik. Menutup transaksi otomatis pada %.2f Liter.\n", (float)currentFillMl / 1000.0);
            pauseStartTime = 0;
            stopFilling(true); // Selesaikan transaksi otomatis dengan literan yang sudah terisi
        }
    }

    // 3. Polling server rutin (Setiap 1.5 detik di SEMUA status: Standby, Waiting, Filling, Paused)
    //    Memastikan ESP32 SELALU 🟢 ONLINE dan telemetry terkirim real-time
    if (millis() - lastPollTime >= POLL_INTERVAL) {
        lastPollTime = millis();
        checkOrderFromServer();
    }

    // 4. Hitung debit dan volume air setiap 1 detik saat pengisian aktif
    if ((millis() - oldTime) > 1000) {
        detachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN));
        
        flowRate = ((1000.0 / (millis() - oldTime)) * pulseCount) / calibrationFactor;
        oldTime = millis();
        
        unsigned int mlThisSecond = (flowRate / 60.0) * 1000;
        
        if (isFilling && !isPaused) {
            currentFillMl += mlThisSecond;
            totalAccumulatedMl += mlThisSecond;

            Serial.printf("⏳ Mengisi... [%.2f / %.2f Liter] - Debit: %.1f L/min\n", 
                          (float)currentFillMl / 1000.0, 
                          (float)targetFillMl / 1000.0, 
                          flowRate);

            if (currentFillMl >= targetFillMl) {
                stopFilling(true);
            }
        }
        
        pulseCount = 0;
        attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), pulseCounter, FALLING);
    }

    // 5. Update lampu LED tombol (Merah vs Hijau)
    updateLeds();
}