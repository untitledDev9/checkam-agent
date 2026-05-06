/**
 * windows.ts
 * Reads disk health on Windows via PowerShell Get-PhysicalDisk +
 * Get-StorageReliabilityCounter (temperature & wear level where available).
 */

import { execSync } from 'child_process';
import type { StorageData, StorageDisk } from './types';

function encodeCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function normalizeHealth(h: string): StorageDisk['healthStatus'] {
  const s = (h || '').toLowerCase();
  if (s === 'healthy')   return 'Healthy';
  if (s === 'warning')   return 'Warning';
  if (s === 'unhealthy') return 'Unhealthy';
  return 'Unknown';
}

function normalizeMediaType(m: string): StorageDisk['mediaType'] {
  const s = (m || '').toLowerCase();
  if (s === 'nvme' || s === 'scm') return 'NVMe';
  if (s === 'ssd')                 return 'SSD';
  if (s === 'hdd')                 return 'HDD';
  return 'Unknown';
}

export async function getWindowsStorage(): Promise<StorageData> {
  const script = `
$out = @()
try {
  $disks = Get-PhysicalDisk
  foreach ($disk in $disks) {
    $rel = $null
    try { $rel = $disk | Get-StorageReliabilityCounter -ErrorAction Stop } catch {}
    $out += [PSCustomObject]@{
      Model       = $disk.FriendlyName
      Health      = "$($disk.HealthStatus)"
      SizeGB      = [math]::Round($disk.Size / 1GB, 1)
      MediaType   = "$($disk.MediaType)"
      Temperature = if ($rel -and $rel.Temperature -gt 0) { [int]$rel.Temperature } else { $null }
      Wear        = if ($rel -and $rel.Wear -gt 0) { [int]$rel.Wear } else { $null }
    }
  }
} catch {
  throw "Get-PhysicalDisk failed: $_"
}
if ($out.Count -eq 1) { $out[0] | ConvertTo-Json -Compress } else { $out | ConvertTo-Json -Compress }
`.trim();

  const encoded = encodeCommand(script);

  let raw: string;
  try {
    raw = execSync(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, timeout: 30_000 }
    ).trim();
  } catch (err: unknown) {
    throw new Error(`Storage read failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let parsed: any[];
  try {
    const json = JSON.parse(raw);
    parsed = Array.isArray(json) ? json : [json];
  } catch {
    throw new Error('Failed to parse storage data from PowerShell output.');
  }

  const disks: StorageDisk[] = parsed.map((d: any) => ({
    model:        d.Model      || 'Unknown Drive',
    healthStatus: normalizeHealth(d.Health),
    mediaType:    normalizeMediaType(d.MediaType),
    sizeGB:       d.SizeGB     ?? 0,
    temperature:  d.Temperature ?? null,
    wearLevel:    d.Wear        ?? null,
  }));

  return { platform: 'windows', disks };
}
