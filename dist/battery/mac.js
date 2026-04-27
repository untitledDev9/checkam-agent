"use strict";
/**
 * mac.ts
 * Reads battery health on macOS via:
 *   ioreg -l -n AppleSmartBattery
 * Values are in mAh. Cycle count is included.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMacBattery = getMacBattery;
const child_process_1 = require("child_process");
/** Pull a numeric value from ioreg output by key name */
function parseIoreg(output, key) {
    const regex = new RegExp(`"${key}"\\s*=\\s*(\\d+)`);
    const match = output.match(regex);
    return match ? parseInt(match[1], 10) : null;
}
async function getMacBattery() {
    let ioregOutput;
    try {
        ioregOutput = (0, child_process_1.execSync)('ioreg -l -n AppleSmartBattery', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`ioreg command failed: ${msg}`);
    }
    const designCapacity = parseIoreg(ioregOutput, 'DesignCapacity');
    const fullChargeCapacity = parseIoreg(ioregOutput, 'MaxCapacity');
    const cycleCount = parseIoreg(ioregOutput, 'CycleCount');
    if (!designCapacity || designCapacity === 0) {
        throw new Error('Could not read DesignCapacity. This Mac may not have a battery or ioreg is unavailable.');
    }
    if (!fullChargeCapacity) {
        throw new Error('Could not read MaxCapacity from ioreg output.');
    }
    const health = parseFloat(((fullChargeCapacity / designCapacity) * 100).toFixed(1));
    return {
        platform: 'mac',
        health,
        designCapacity,
        fullChargeCapacity,
        cycleCount: cycleCount ?? null,
        unit: 'mAh',
    };
}
