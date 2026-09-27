/*
  ===========================================================================================
  PROYEK   : DEPOT AIR ISI ULANG OTOMATIS - DANA.ASPARTECH.COM (FIXED)
  PINOUT   : 
    - GPIO 18 : Water Flow Sensor YF-S201 (Signal Kuning)
    - GPIO 26 : Relay Solenoid Valve 12V (IN Relay)
    - GPIO 19 : Active Buzzer 5V
    - GPIO 4  : Tombol Emergency Stop (Push Button ke GND)
    - GPIO 2  : Built-in LED Status
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
// 1. DEFAULT KONFIGURASI WIFI & SERVER CLOUD
// ==========================================================
String wifi_ssid     = "Ade";          // SSID WiFi Router
String wifi_password = "19052026";     // Password WiFi Router

const char* BASE_SERVER_URL = "https://dana.aspartech.com";

// Endpoint API
String urlCheckOrder = String(BASE_SERVER_URL) + "/api/esp32/check-order";
String urlFinishFill = String(BASE_SERVER_URL) + "/api/esp32/finish-fill";
String urlTelemetry  = String(BASE_SERVER_URL) + "/api/esp32/telemetry";

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
const int BLUE_LED_PIN    = 2;  // LED Indikator Status (D2)
const int BUTTON_STOP_PIN = 32; // Tombol Darurat Manual (D32)
const int FLOW_SENSOR_PIN = 34; // Sinyal Kuning Sensor Flow YF-S201 (D34)
const int BUZZER_PIN      = 19; // Buzzer 5V (D19) - Opsi jika nanti dipasang

// Logika Relay (Active LOW)
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

// ==========================================================
// 3. VARIABEL FLOW SENSOR & SISTEM
// ==========================================================
bool isFilling = false;
unsigned long currentFillMl = 0;
unsigned long targetFillMl  = 0;
unsigned long totalAccumulatedMl = 0;
String currentOrderId = "";

volatile byte pulseCount = 0;
float flowRate = 0.0;
unsigned long oldTime = 0;
const float calibrationFactor = 7.5; // YF-S201

unsigned long lastPollTime = 0;
const unsigned long POLL_INTERVAL = 2000;

unsigned long lastDebounceTime = 0;
bool lastButtonState = HIGH;

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

// ==========================================================
// 4. MEMUAT & MENYIMPAN WIFI DARI FLASH NVS
// ==========================================================
void loadStoredWiFi() {
    preferences.begin("depot_wifi", false);
    String storedSSID = preferences.getString("ssid", "");
    String storedPASS = preferences.getString("pass", "");
    preferences.end();

    // Jika di memori NVS masih tersimpan hotspot lama "Jazz" atau "Ade", pastikan terhubung ke Ade dengan password baru
    if (storedSSID == "Jazz" || storedSSID == "Ade") {
        saveWiFiToNVS("Ade", "19052026");
        storedSSID = "Ade";
        storedPASS = "19052026";
    }

    if (storedSSID.length() > 0 && storedPASS.length() > 0) {
        wifi_ssid = storedSSID;
        wifi_password = storedPASS;
        Serial.print("📂 Membaca WiFi dari memori NVS ESP32: ");
        Serial.println(wifi_ssid);
    } else {
        Serial.println("ℹ️ Memakai konfigurasi default: " + wifi_ssid);
    }
}

void clearWiFiNVS() {
    preferences.begin("depot_wifi", false);
    preferences.clear();
    preferences.end();
}

void saveWiFiToNVS(String newSsid, String newPass) {
    preferences.begin("depot_wifi", false);
    preferences.putString("ssid", newSsid);
    preferences.putString("pass", newPass);
    preferences.end();
    
    wifi_ssid = newSsid;
    wifi_password = newPass;

    Serial.println("\n💾 [NVS] WiFi baru berhasil disimpan permanen ke memori Flash ESP32!");
    Serial.print("SSID Baru: "); Serial.println(newSsid);
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

    // Reset radio WiFi agar tidak crash/stuck
    WiFi.persistent(false);
    WiFi.disconnect(true, true);
    delay(200);
    
    WiFi.mode(WIFI_STA);
    delay(200);

    WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());

    unsigned long startAttemptTime = millis();

    while (WiFi.status() != WL_CONNECTED && (millis() - startAttemptTime < (unsigned long)timeoutSeconds * 1000)) {
        delay(250);
        yield(); // Mencegah Watchdog Timer (TG1WDT) Reset
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
        Serial.print("[WIFI] Status Code: "); Serial.println(WiFi.status());
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
        String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'><title>Pengaturan WiFi Depot Air</title>"
                      "<style>body{font-family:sans-serif;background:#0f172a;color:#fff;padding:20px;text-align:center;}"
                      ".card{background:#1e293b;padding:24px;border-radius:16px;max-width:350px;margin:auto;}"
                      "input{width:100%;padding:10px;margin:10px 0;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff;box-sizing:border-box;}"
                      "button{background:#0284c7;color:#fff;border:none;padding:12px;width:100%;border-radius:8px;font-weight:bold;cursor:pointer;}</style></head>"
                      "<body><div class='card'><h2>Pengaturan WiFi ESP32</h2><p style='font-size:13px;color:#94a3b8;'>Masukkan WiFi Rumah / Hotspot HP:</p>"
                      "<form action='/save' method='POST'>"
                      "<input type='text' name='ssid' placeholder='Nama WiFi (SSID)' required>"
                      "<input type='password' name='pass' placeholder='Password WiFi'>"
                      "<button type='submit'>Simpan & Sambungkan</button></form></div></body></html>";
        apServer.send(200, "text/html", html);
    });

    apServer.on("/save", []() {
        if (apServer.hasArg("ssid")) {
            String s = apServer.arg("ssid");
            String p = apServer.hasArg("pass") ? apServer.arg("pass") : "";
            saveWiFiToNVS(s, p);

            String resp = "<html><body style='background:#0f172a;color:#fff;text-align:center;padding:40px;font-family:sans-serif;'>"
                          "<h2>✅ Tersimpan!</h2><p>ESP32 sedang me-restart untuk konek ke " + s + "...</p></body></html>";
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
void startFilling(String orderId, float targetLiters) {
    currentOrderId = orderId;
    targetFillMl = (unsigned long)(targetLiters * 1000.0);
    currentFillMl = 0;
    isFilling = true;
    
    digitalWrite(RELAY_PIN, RELAY_ON);
    digitalWrite(BLUE_LED_PIN, HIGH);
    
    Serial.println("\n==========================================");
    Serial.print("🚰 MEMULAI PENGISIAN AIR: "); 
    Serial.print(targetLiters); 
    Serial.println(" Liter");
    Serial.print("📦 Order ID: ");
    Serial.println(orderId);
    Serial.println("==========================================");
    
    triggerBuzzer(1, 250);
}

void notifyServerFinished(bool isFinishedSuccess) {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    http.begin(secureClient, urlFinishFill);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["orderId"]         = currentOrderId;
    doc["dispensedLiter"]  = (float)currentFillMl / 1000.0;
    doc["status"]          = isFinishedSuccess ? "COMPLETED" : "EMERGENCY_STOP";

    String jsonBody;
    serializeJson(doc, jsonBody);

    http.POST(jsonBody);
    http.end();
}

void sendLiveTelemetry() {
    if (WiFi.status() != WL_CONNECTED || !isFilling) return;

    HTTPClient http;
    http.begin(secureClient, urlTelemetry);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["orderId"]      = currentOrderId;
    doc["currentLiter"] = (float)currentFillMl / 1000.0;
    doc["flowRate"]     = flowRate;

    String jsonBody;
    serializeJson(doc, jsonBody);

    http.POST(jsonBody);
    http.end();
}

void stopFilling(bool isFinishedSuccess = true) {
    isFilling = false;
    digitalWrite(RELAY_PIN, RELAY_OFF);
    digitalWrite(BLUE_LED_PIN, LOW);
    
    if (isFinishedSuccess) {
        Serial.println("\n🎉 --> PENGISIAN SELESAI OTOMATIS!");
        triggerBuzzer(4, 120, 80);
        notifyServerFinished(true);
    } else {
        Serial.println("\n🚨 --> PENGISIAN DIHENTIKAN MANUAL / EMERGENCY!");
        triggerBuzzer(2, 350, 100);
        notifyServerFinished(false);
    }

    currentOrderId = "";
    targetFillMl = 0;
    currentFillMl = 0;
}

// ==========================================================
// 8. POLLING CLOUD SERVER
// ==========================================================
void checkOrderFromServer() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("⚠️ WiFi terputus, mencoba koneksi ulang...");
        WiFi.reconnect();
        return;
    }

    HTTPClient http;
    String url = urlCheckOrder + "?ssid=" + wifi_ssid;
    
    http.begin(secureClient, url);
    http.setTimeout(4000);

    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (!error) {
            const char* status = doc["status"];
            
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

            if (status && strcmp(status, "PAID") == 0) {
                String orderId = doc["orderId"].as<String>();
                float targetLiters = doc["targetLiter"].as<float>();

                startFilling(orderId, targetLiters);
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
    delay(1000);

    Serial.println("\n=================================================");
    Serial.println("💧 ESP32 DEPOT AIR OTOMATIS - DANA.ASPARTECH.COM");
    Serial.println("=================================================");

    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, RELAY_OFF);

    pinMode(BLUE_LED_PIN, OUTPUT);
    digitalWrite(BLUE_LED_PIN, LOW);

    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);

    secureClient.setInsecure();

    // Hapus NVS lama agar SSID/Password baru dari variabel langsung terpakai
    clearWiFiNVS(); 
    loadStoredWiFi();

    if (!connectToWiFi(12)) {
        startEmergencyAP();
    }

    pinMode(BUTTON_STOP_PIN, INPUT_PULLUP);
    pinMode(FLOW_SENSOR_PIN, INPUT);
    attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), pulseCounter, FALLING);
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

    if (!isFilling) {
        if (millis() - lastPollTime >= POLL_INTERVAL) {
            lastPollTime = millis();
            checkOrderFromServer();
        }
    }

    if ((millis() - oldTime) > 1000) {
        detachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN));
        
        flowRate = ((1000.0 / (millis() - oldTime)) * pulseCount) / calibrationFactor;
        oldTime = millis();
        
        unsigned int mlThisSecond = (flowRate / 60.0) * 1000;
        
        if (isFilling) {
            currentFillMl += mlThisSecond;
            totalAccumulatedMl += mlThisSecond;

            Serial.printf("⏳ Mengisi... [%.2f / %.2f Liter] - Debit: %.1f L/min\n", 
                          (float)currentFillMl / 1000.0, 
                          (float)targetFillMl / 1000.0, 
                          flowRate);

            sendLiveTelemetry();

            if (currentFillMl >= targetFillMl) {
                stopFilling(true);
            }
        }
        
        pulseCount = 0;
        attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), pulseCounter, FALLING);
    }

    int btnRead = digitalRead(BUTTON_STOP_PIN);
    if (btnRead == LOW && lastButtonState == HIGH) {
        if (millis() - lastDebounceTime > 250) {
            if (isFilling) {
                stopFilling(false);
            }
            lastDebounceTime = millis();
        }
    }
    lastButtonState = btnRead;
}