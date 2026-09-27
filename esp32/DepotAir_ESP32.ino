#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ==========================================================
// 1. KONFIGURASI WIFI & SERVER CLOUD
// ==========================================================
const char* WIFI_SSID     = "NAMA_WIFI_ANDA";     // Ganti dengan nama WiFi Anda
const char* WIFI_PASSWORD = "PASSWORD_WIFI_ANDA"; // Ganti dengan password WiFi Anda

// Domain Server Backend Anda
const char* BASE_SERVER_URL = "https://dana.aspartech.com";

// Endpoint API
String urlCheckOrder = String(BASE_SERVER_URL) + "/api/esp32/check-order";
String urlFinishFill = String(BASE_SERVER_URL) + "/api/esp32/finish-fill";
String urlTelemetry  = String(BASE_SERVER_URL) + "/api/esp32/telemetry";

// ==========================================================
// 2. PENETAPAN PIN ESP32 (Sesuai Hardware Anda)
// ==========================================================
const int RELAY_PIN       = 26; // Relay Solenoid Valve
const int BLUE_LED_PIN    = 2;  // LED Indikator Status
const int BUTTON_STOP_PIN = 4;  // Tombol Darurat (Stop/Pause)
const int FLOW_SENSOR_PIN = 18; // Sinyal Kuning Sensor Water Flow
const int BUZZER_PIN      = 19; // Sinyal (+) Buzzer

// Logika Relay (Sebagian besar modul Relay adalah Active LOW)
const int RELAY_ON  = LOW;  // Jika relay Anda aktif HIGH, ganti jadi HIGH
const int RELAY_OFF = HIGH; // Jika relay Anda aktif HIGH, ganti jadi LOW

// ==========================================================
// 3. VARIABEL PROSES PENGISIAN AIR & SENSOR FLOW
// ==========================================================
bool isFilling = false;                 // Status apakah sedang mengisi air
unsigned long currentFillMl = 0;       // Liter terisi pada transaksi SEKARANG (mL)
unsigned long targetFillMl  = 0;       // Target liter transaksi (mL)
unsigned long totalAccumulatedMl = 0;  // Total akumulasi seluruh transaksi (mL)
String currentOrderId = "";            // ID Transaksi DANA yang sedang diproses

volatile byte pulseCount = 0;
float flowRate = 0.0;                  // Debit (L/min)
unsigned long oldTime = 0;
const float calibrationFactor = 7.5;   // Faktor Kalibrasi Sensor YF-S201

// Polling interval ke server
unsigned long lastPollTime = 0;
const unsigned long POLL_INTERVAL = 2000; // Cek order baru tiap 2 detik

// Debounce tombol
unsigned long lastDebounceTime = 0;
bool lastButtonState = HIGH;

// ==========================================================
// 4. INTERRUPT SERVICE ROUTINE (ISR)
// ==========================================================
void IRAM_ATTR pulseCounter() {
    pulseCount++;
}

// ==========================================================
// 5. NADA BUZZER
// ==========================================================
void triggerBuzzer(int beepCount, int durationMs = 80, int pauseMs = 80) {
    for (int i = 0; i < beepCount; i++) {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(durationMs);
        digitalWrite(BUZZER_PIN, LOW);
        if (i < beepCount - 1) delay(pauseMs);
    }
}

// ==========================================================
// 6. FUNGSI MEMULAI PENGISIAN
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
    
    triggerBuzzer(1, 250); // Bip 1x tanda mulai
}

// ==========================================================
// 7. FUNGSI MENGIRIM STATUS SELESAI KE SERVER
// ==========================================================
void notifyServerFinished(bool isFinishedSuccess) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi terputus saat kirim laporan selesai!");
        return;
    }

    HTTPClient http;
    http.begin(urlFinishFill);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["orderId"]         = currentOrderId;
    doc["dispensedLiter"]  = (float)currentFillMl / 1000.0;
    doc["status"]          = isFinishedSuccess ? "COMPLETED" : "EMERGENCY_STOP";

    String jsonBody;
    serializeJson(doc, jsonBody);

    Serial.print("📤 Mengirim konfirmasi ke server: ");
    Serial.println(jsonBody);

    int httpCode = http.POST(jsonBody);
    if (httpCode > 0) {
        Serial.printf("✅ Server merespons code: %d\n", httpCode);
    } else {
        Serial.printf("❌ Gagal kirim ke server, error: %s\n", http.errorToString(httpCode).c_str());
    }
    http.end();
}

// ==========================================================
// 8. FUNGSI MENGIRIM TELEMETRI REAL-TIME (LITER LIVE)
// ==========================================================
void sendLiveTelemetry() {
    if (WiFi.status() != WL_CONNECTED || !isFilling) return;

    HTTPClient http;
    http.begin(urlTelemetry);
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

// ==========================================================
// 9. FUNGSI MENGHENTIKAN PENGISIAN
// ==========================================================
void stopFilling(bool isFinishedSuccess = true) {
    isFilling = false;
    digitalWrite(RELAY_PIN, RELAY_OFF);
    digitalWrite(BLUE_LED_PIN, LOW);
    
    if (isFinishedSuccess) {
        Serial.println("\n🎉 --> PENGISIAN SELESAI OTOMATIS!");
        triggerBuzzer(4, 120, 80); // Bip 4x cepat tanda sukses selesai!
        notifyServerFinished(true);
    } else {
        Serial.println("\n🚨 --> PENGISIAN DIHENTIKAN MANUAL / EMERGENCY!");
        triggerBuzzer(2, 350, 100); // Bip panjang 2x tanda stop
        notifyServerFinished(false);
    }

    currentOrderId = "";
    targetFillMl = 0;
    currentFillMl = 0;
}

// ==========================================================
// 10. FUNGSI POLLING KE SERVER (/api/esp32/check-order)
// ==========================================================
void checkOrderFromServer() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("⚠️ WiFi terputus, mencoba koneksi ulang...");
        WiFi.reconnect();
        return;
    }

    HTTPClient http;
    http.begin(urlCheckOrder);
    http.setTimeout(3500);

    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (!error) {
            const char* status = doc["status"];
            
            // Jika ada pembayaran DANA yang sukses masuk (status == PAID)
            if (status && strcmp(status, "PAID") == 0) {
                String orderId = doc["orderId"].as<String>();
                float targetLiters = doc["targetLiter"].as<float>();

                // Mulai mengalirkan air sesuai pesanan
                startFilling(orderId, targetLiters);
            }
        }
    }
    http.end();
}

// ==========================================================
// 11. SETUP
// ==========================================================
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n=================================================");
    Serial.println("💧 ESP32 DEPOT AIR OTOMATIS - DANA.ASPARTECH.COM");
    Serial.println("=================================================");

    pinMode(RELAY_PIN, OUTPUT);
    pinMode(BLUE_LED_PIN, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(BUTTON_STOP_PIN, INPUT_PULLUP);
    pinMode(FLOW_SENSOR_PIN, INPUT_PULLUP);

    digitalWrite(RELAY_PIN, RELAY_OFF);
    digitalWrite(BLUE_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);

    attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), pulseCounter, FALLING);

    // Hubungkan ke WiFi Internet
    Serial.print("Menghubungkan ke WiFi: ");
    Serial.println(WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int count = 0;
    while (WiFi.status() != WL_CONNECTED && count < 30) {
        delay(500);
        Serial.print(".");
        digitalWrite(BLUE_LED_PIN, !digitalRead(BLUE_LED_PIN)); // Blink saat connecting
        count++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n✅ WiFi Terhubung!");
        Serial.print("IP ESP32: "); Serial.println(WiFi.localIP());
        digitalWrite(BLUE_LED_PIN, HIGH);
        triggerBuzzer(2, 80, 80); // Bip 2x tanda online
    } else {
        Serial.println("\n❌ Gagal konek WiFi! Periksa SSID & Password.");
    }
}

// ==========================================================
// 12. LOOP UTAMA
// ==========================================================
void loop() {
    // --- 1. POLLING SERVER DANA SETIAP 2 DETIK (JIKA SEDANG TIDAK MENGISI) ---
    if (!isFilling) {
        if (millis() - lastPollTime >= POLL_INTERVAL) {
            lastPollTime = millis();
            checkOrderFromServer();
        }
    }

    // --- 2. PROSES HITUNGAN VOLUME AIR & SENSOR FLOW SETIAP 1 DETIK ---
    if ((millis() - oldTime) > 1000) {
        detachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN));
        
        flowRate = ((1000.0 / (millis() - oldTime)) * pulseCount) / calibrationFactor;
        oldTime = millis();
        
        // Hitung mililiter air yang mengalir dalam 1 detik ini
        unsigned int mlThisSecond = (flowRate / 60.0) * 1000;
        
        if (isFilling) {
            currentFillMl += mlThisSecond;
            totalAccumulatedMl += mlThisSecond;

            Serial.printf("⏳ Mengisi... [%.2f / %.2f Liter] - Debit: %.1f L/min\n", 
                          (float)currentFillMl / 1000.0, 
                          (float)targetFillMl / 1000.0, 
                          flowRate);

            // Kirim telemetri live ke dashboard web
            sendLiveTelemetry();

            // CEK OTO-STOP: Apakah air terisi sudah mencapai target?
            if (currentFillMl >= targetFillMl) {
                stopFilling(true); // Selesai otomatis!
            }
        }
        
        pulseCount = 0;
        attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), pulseCounter, FALLING);
    }

    // --- 3. TOMBOL DARURAT (MANUAL STOP) ---
    int btnRead = digitalRead(BUTTON_STOP_PIN);
    if (btnRead == LOW && lastButtonState == HIGH) {
        if (millis() - lastDebounceTime > 250) {
            if (isFilling) {
                stopFilling(false); // Hentikan pengisian jika sedang berjalan
            }
            lastDebounceTime = millis();
        }
    }
    lastButtonState = btnRead;
}
