/*
 * Tend e-ink display — Seeed reTerminal E1001 (ESP32-S3, 800×480 GDEY075T7).
 *
 * Life cycle: wake → (button action) → Wi-Fi → GET /eink raw frame → paint →
 * deep sleep. The panel keeps its image with zero power, so between wakes the
 * board draws essentially nothing.
 *
 * Buttons (left → right, matching the on-screen legend, active low):
 *   KEY2 GPIO5  = A · cycle view (priority ↔ buckets)
 *   KEY1 GPIO4  = B · refresh now
 *   KEY0 GPIO3  = C · done #1 (asks the server to archive the top task)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <SPI.h>
#include <GxEPD2_BW.h>
#include "config.h"

// ---- Pins (Seeed wiki: reTerminal E10xx) ----
#define EPD_SCK_PIN 7
#define EPD_MOSI_PIN 9
#define EPD_CS_PIN 10
#define EPD_DC_PIN 11
#define EPD_RES_PIN 12
#define EPD_BUSY_PIN 13
#define KEY_DONE 3    // right (green)
#define KEY_REFRESH 4 // middle
#define KEY_VIEW 5    // left
#define BUZZER_PIN 45
#define BATTERY_ADC_PIN 1
#define BATTERY_ENABLE_PIN 21

#define FRAME_BYTES (800UL * 480UL / 8UL) // 48,000

GxEPD2_BW<GxEPD2_750_GDEY075T7, GxEPD2_750_GDEY075T7::HEIGHT>
    display(GxEPD2_750_GDEY075T7(EPD_CS_PIN, EPD_DC_PIN, EPD_RES_PIN, EPD_BUSY_PIN));
SPIClass hspi(HSPI);
Preferences prefs;
static uint8_t frame[FRAME_BYTES];

static void chirp(int freq, int ms) {
  tone(BUZZER_PIN, freq, ms);
  delay(ms + 20);
}

static bool wifiUp() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) delay(250);
  return WiFi.status() == WL_CONNECTED;
}

/** GET the current view's raw frame into `frame`. */
static bool fetchFrame(const char* view) {
  WiFiClientSecure client;
  client.setInsecure(); // password auth; TLS still encrypts the transport
  HTTPClient https;
  String url = String(TEND_API_BASE) + "/eink?format=raw&view=" + view;
  if (!https.begin(client, url)) return false;
  https.addHeader("x-app-password", TEND_PASSWORD);
  https.setTimeout(20000);
  int code = https.GET();
  if (code != 200) {
    Serial.printf("[tend] eink GET %d\n", code);
    https.end();
    return false;
  }
  WiFiClient* stream = https.getStreamPtr();
  size_t got = 0;
  uint32_t deadline = millis() + 25000;
  while (got < FRAME_BYTES && millis() < deadline) {
    size_t n = stream->readBytes(frame + got, FRAME_BYTES - got);
    got += n;
    if (n == 0) delay(20);
  }
  https.end();
  Serial.printf("[tend] frame bytes: %u\n", (unsigned)got);
  return got == FRAME_BYTES;
}

/** Ask the server to archive the top task (display button C). */
static bool completeTop() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;
  if (!https.begin(client, String(TEND_API_BASE) + "/board")) return false;
  https.addHeader("content-type", "application/json");
  https.addHeader("x-app-password", TEND_PASSWORD);
  https.setTimeout(20000);
  int code = https.POST("{\"completeTop\":true}");
  Serial.printf("[tend] completeTop %d\n", code);
  https.end();
  return code == 200;
}

static void paint() {
  if (INVERT_IMAGE) {
    for (size_t i = 0; i < FRAME_BYTES; i++) frame[i] = ~frame[i];
  }
  hspi.begin(EPD_SCK_PIN, -1, EPD_MOSI_PIN, -1);
  display.epd2.selectSPI(hspi, SPISettings(2000000, MSBFIRST, SPI_MODE0));
  display.init(115200);
  display.epd2.drawImage(frame, 0, 0, 800, 480, false, false, false);
  display.hibernate();
}

static void goToSleep() {
  // Wake on the 15-min timer or any button (all three are RTC-capable pins).
  esp_sleep_enable_timer_wakeup((uint64_t)REFRESH_MINUTES * 60ULL * 1000000ULL);
  const uint64_t mask =
      (1ULL << KEY_DONE) | (1ULL << KEY_REFRESH) | (1ULL << KEY_VIEW);
  esp_sleep_enable_ext1_wakeup(mask, ESP_EXT1_WAKEUP_ANY_LOW);
  Serial.println("[tend] sleeping");
  Serial.flush();
  esp_deep_sleep_start();
}

void setup() {
  Serial.begin(115200);
  pinMode(KEY_DONE, INPUT);
  pinMode(KEY_REFRESH, INPUT);
  pinMode(KEY_VIEW, INPUT);
  pinMode(BATTERY_ENABLE_PIN, OUTPUT);

  prefs.begin("tend", false);
  String view = prefs.getString("view", "A");

  // What woke us?
  bool doComplete = false;
  esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
  if (cause == ESP_SLEEP_WAKEUP_EXT1) {
    uint64_t pins = esp_sleep_get_ext1_wakeup_status();
    if (pins & (1ULL << KEY_VIEW)) {
      view = view == "A" ? "B" : "A"; // A: cycle view
      prefs.putString("view", view);
    } else if (pins & (1ULL << KEY_DONE)) {
      doComplete = true; // C: archive top task
    } // KEY_REFRESH: nothing special — the refetch below IS the refresh
  }
  Serial.printf("[tend] wake cause %d, view %s\n", (int)cause, view.c_str());

  // Battery telemetry (log only for now).
  digitalWrite(BATTERY_ENABLE_PIN, HIGH);
  delay(10);
  float vbat = (analogReadMilliVolts(BATTERY_ADC_PIN) / 1000.0f) * 2.0f;
  digitalWrite(BATTERY_ENABLE_PIN, LOW);
  Serial.printf("[tend] battery %.2fV\n", vbat);

  if (wifiUp()) {
    if (doComplete) {
      if (completeTop()) chirp(1600, 90); // little "done" beep
      else chirp(300, 250);
    }
    if (fetchFrame(view.c_str())) {
      paint();
    } else {
      Serial.println("[tend] fetch failed — keeping last image");
    }
  } else {
    Serial.println("[tend] wifi failed — keeping last image");
  }
  WiFi.disconnect(true);

  goToSleep();
}

void loop() {}
