"use strict";
/**
 * submit.ts
 * Posts battery data to the CheckAm backend, fulfilling a pending session.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_VERSION = void 0;
exports.submitBatterySession = submitBatterySession;
const axios_1 = __importDefault(require("axios"));
const API_BASE = process.env.API_URL ||
    'https://gadgetvault-backend.onrender.com/api/v1';
exports.AGENT_VERSION = '1.0.0';
async function submitBatterySession(sessionId, data, imei) {
    const url = `${API_BASE}/battery-sessions/${sessionId}`;
    await axios_1.default.post(url, {
        health: data.health,
        cycleCount: data.cycleCount,
        designCapacity: data.designCapacity,
        fullChargeCapacity: data.fullChargeCapacity,
        platform: data.platform,
        imei: imei || null,
        agentVersion: exports.AGENT_VERSION,
    }, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
    });
}
