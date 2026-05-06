/**
 * mac.ts
 * Reads disk health on macOS via system_profiler.
 * Covers NVMe (M1/M2/M3 + modern Intel) and SATA (older Intel Macs).
 */

import { execSync } from 'child_process';
import type { StorageData, StorageDisk } from './types';

function parseSize(sizeStr: string): number {
  if (!sizeStr) return 0;
  const match = sizeStr.match(/([\d.,]+)\s*(GB|TB|MB)/i);
  if (!match) return 0;
  const val = parseFloat(match[1].replace(/,/g, ''));
  const unit = match[2].toUpperCase();
  if (unit === 'TB') return Math.round(val * 1024);
  if (unit === 'MB') return Math.round(val / 1024);
  return Math.round(val);
}

function parseSmartStatus(s: string): StorageDisk['healthStatus'] {
  const lower = (s || '').toLowerCase();
  if (lower === 'verified' || lower === 'passed') return 'Healthy';
  if (lower === 'failing'  || lower === 'failed') return 'Unhealthy';
  return 'Unknown';
}

export async function getMacStorage(): Promise<StorageData> {
  const disks: StorageDisk[] = [];

  // NVMe drives (M1/M2/M3 and modern Intel Macs)
  try {
    const raw = execSync('system_profiler SPNVMeDataType -json', {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15_000,
    });
    const data = JSON.parse(raw);
    for (const controller of (data.SPNVMeDataType || [])) {
      for (const item of (controller._items || [])) {
        disks.push({
          model:        item._name         || 'NVMe Drive',
          healthStatus: parseSmartStatus(item.smart_status),
          mediaType:    'NVMe',
          sizeGB:       parseSize(item.size),
          temperature:  null,
          wearLevel:    null,
        });
      }
    }
  } catch { /* no NVMe or unavailable */ }

  // SATA drives (older Intel Macs)
  try {
    const raw = execSync('system_profiler SPSerialATADataType -json', {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15_000,
    });
    const data = JSON.parse(raw);
    for (const controller of (data.SPSerialATADataType || [])) {
      for (const item of (controller._items || [])) {
        const isSSD = (item.spsata_medium_type || '').toLowerCase().includes('solid');
        disks.push({
          model:        item._name || 'Drive',
          healthStatus: parseSmartStatus(item.smart_status),
          mediaType:    isSSD ? 'SSD' : 'HDD',
          sizeGB:       parseSize(item.size),
          temperature:  item.spsata_temperature ? parseInt(item.spsata_temperature) : null,
          wearLevel:    null,
        });
      }
    }
  } catch { /* no SATA or unavailable */ }

  return { platform: 'mac', disks };
}
