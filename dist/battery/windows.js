"use strict";
/**
 * windows.ts
 * Reads battery health on Windows via:
 *   powercfg /batteryreport /output <file>
 * Then parses the resulting HTML with cheerio.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWindowsBattery = getWindowsBattery;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cheerio = __importStar(require("cheerio"));
const REPORT_PATH = path.join(process.cwd(), 'battery-report.html');
/** Strip units and commas → number. "50,000 mWh" → 50000 */
function parseCapacity(raw) {
    if (!raw)
        return null;
    const cleaned = raw.replace(/[^\d.]/g, '');
    const value = parseFloat(cleaned);
    return isNaN(value) ? null : value;
}
/** Search every table cell, return the adjacent cell's text when label matches */
function findValueByLabel($, label) {
    let found = null;
    $('table tr').each((_, row) => {
        const cells = $(row).find('td, th');
        cells.each((i) => {
            if ($(cells[i]).text().trim().toUpperCase().includes(label.toUpperCase())) {
                const next = cells.eq(i + 1);
                if (next.length) {
                    found = next.text().trim();
                    return false;
                }
            }
        });
        if (found)
            return false;
    });
    return found;
}
async function getWindowsBattery() {
    // 1. Generate report
    try {
        (0, child_process_1.execSync)(`powercfg /batteryreport /output "${REPORT_PATH}"`, {
            stdio: 'pipe',
            windowsHide: true,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('access denied') || msg.toLowerCase().includes('administrator')) {
            throw new Error('Run CheckAm Agent as Administrator to read battery data.');
        }
        throw new Error(`powercfg failed: ${msg}`);
    }
    if (!fs.existsSync(REPORT_PATH)) {
        throw new Error('Battery report file was not created. This machine may not have a battery.');
    }
    // 2. Parse HTML
    const html = fs.readFileSync(REPORT_PATH, 'utf-8');
    const $ = cheerio.load(html);
    const designCapacity = parseCapacity(findValueByLabel($, 'DESIGN CAPACITY'));
    const fullChargeCapacity = parseCapacity(findValueByLabel($, 'FULL CHARGE CAPACITY'));
    const cycleCount = parseCapacity(findValueByLabel($, 'CYCLE COUNT'));
    if (!designCapacity || designCapacity === 0) {
        throw new Error('Could not read Design Capacity. Device may not have a battery.');
    }
    if (!fullChargeCapacity) {
        throw new Error('Could not read Full Charge Capacity from battery report.');
    }
    // 3. Clean up report file
    try {
        fs.unlinkSync(REPORT_PATH);
    }
    catch { /* ignore */ }
    const health = parseFloat(((fullChargeCapacity / designCapacity) * 100).toFixed(1));
    return {
        platform: 'windows',
        health,
        designCapacity,
        fullChargeCapacity,
        cycleCount: cycleCount ?? null,
        unit: 'mWh',
    };
}
