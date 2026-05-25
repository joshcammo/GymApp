/**
 * ─────────────────────────────────────────────────────────────
 * API Configuration
 *
 * DEV  → your local machine's IP on the LAN (not "localhost" —
 *         that resolves to the phone itself, not your computer)
 *
 *   Android emulator : use 10.0.2.2  (maps to host localhost)
 *   iOS simulator    : use 127.0.0.1 or localhost
 *   Physical device  : find your machine's IP with `ipconfig`
 *                      and replace the address below
 *
 * PROD → your Azure App Service URL
 * ─────────────────────────────────────────────────────────────
 */

declare const __DEV__: boolean;

const DEV_API_URL  = 'http://192.168.50.115:3000/api';   // ← Android emulator default
const PROD_API_URL = 'https://gymtracker-api-joshcammo.azurewebsites.net/api'; // ← change before deploy

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
