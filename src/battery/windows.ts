/**
 * windows.ts
 * Reads battery health on Windows via:
 *   powercfg /batteryreport /output <file>
 * Then parses the resulting HTML with cheerio.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import type { BatteryData } from './types';

const REPORT_PATH = path.join(process.cwd(), 'battery-report.html');

/** Strip units and commas → number. "50,000 mWh" → 50000 */
function parseCapacity(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

/** Search every table cell, return the adjacent cell's text when label matches */
function findValueByLabel($: ReturnType<typeof cheerio.load>, label: string): string | null {
  let found: string | null = null;
  $('table tr').each((_, row) => {
    const cells = $(row).find('td, th');
    cells.each((i: number) => {
      if ($(cells[i]).text().trim().toUpperCase().includes(label.toUpperCase())) {
        const next = cells.eq(i + 1);
        if (next.length) { found = next.text().trim(); return false; }
      }
    });
    if (found) return false;
  });
  return found;
}

export async function getWindowsBattery(): Promise<BatteryData> {
  // 1. Generate report
  try {
    execSync(`powercfg /batteryreport /output "${REPORT_PATH}"`, {
      stdio: 'pipe',
      windowsHide: true,
    });
  } catch (err: unknown) {
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

  const designCapacity    = parseCapacity(findValueByLabel($, 'DESIGN CAPACITY'));
  const fullChargeCapacity = parseCapacity(findValueByLabel($, 'FULL CHARGE CAPACITY'));
  const cycleCount        = parseCapacity(findValueByLabel($, 'CYCLE COUNT'));

  if (!designCapacity || designCapacity === 0) {
    throw new Error('Could not read Design Capacity. Device may not have a battery.');
  }
  if (!fullChargeCapacity) {
    throw new Error('Could not read Full Charge Capacity from battery report.');
  }

  // 3. Clean up report file
  try { fs.unlinkSync(REPORT_PATH); } catch { /* ignore */ }

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
