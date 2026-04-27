/**
 * mac.ts
 * Reads battery health on macOS via:
 *   ioreg -l -n AppleSmartBattery
 * Values are in mAh. Cycle count is included.
 */

import { execSync } from 'child_process';
import type { BatteryData } from './types';

/** Pull a numeric value from ioreg output by key name */
function parseIoreg(output: string, key: string): number | null {
  const regex = new RegExp(`"${key}"\\s*=\\s*(\\d+)`);
  const match = output.match(regex);
  return match ? parseInt(match[1], 10) : null;
}

export async function getMacBattery(): Promise<BatteryData> {
  let ioregOutput: string;

  try {
    ioregOutput = execSync('ioreg -l -n AppleSmartBattery', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`ioreg command failed: ${msg}`);
  }

  const designCapacity    = parseIoreg(ioregOutput, 'DesignCapacity');
  const fullChargeCapacity = parseIoreg(ioregOutput, 'MaxCapacity');
  const cycleCount        = parseIoreg(ioregOutput, 'CycleCount');

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
