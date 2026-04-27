/**
 * submit.ts
 * Posts battery data to the CheckAm backend, fulfilling a pending session.
 */

import axios from 'axios';
import type { BatteryData } from './battery/types';

const API_BASE = process.env.API_URL ||
  'https://gadgetvault-backend-2-production.up.railway.app/api/v1';

export const AGENT_VERSION = '1.0.0';

export async function submitBatterySession(
  sessionId: string,
  data: BatteryData,
  imei?: string
): Promise<void> {
  const url = `${API_BASE}/battery-sessions/${sessionId}`;

  await axios.post(url, {
    health:              data.health,
    cycleCount:          data.cycleCount,
    designCapacity:      data.designCapacity,
    fullChargeCapacity:  data.fullChargeCapacity,
    platform:            data.platform,
    imei:                imei || null,
    agentVersion:        AGENT_VERSION,
  }, {
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
  });
}
