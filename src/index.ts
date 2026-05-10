/**
 * CheckAm Agent — src/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * A tiny Express HTTP server that runs on localhost:47291.
 * checkamm.com fetches battery data from this agent without the user
 * ever leaving the website.
 *
 * Endpoints:
 *   GET  /ping               → health check (used by website to detect agent)
 *   GET  /battery            → read + return battery data
 *   GET  /battery?sessionId= → read + submit to backend + return data
 *
 * Run:
 *   npm run dev          (development)
 *   npm run build && npm start  (production)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { getWindowsBattery } from './battery/windows';
import { getMacBattery }     from './battery/mac';
import { submitBatterySession, AGENT_VERSION } from './submit';
import type { BatteryData } from './battery/types';
import { getWindowsStorage } from './storage/windows';
import { getMacStorage }     from './storage/mac';
import type { StorageData }  from './storage/types';
import AutoLaunch from 'auto-launch';

const app = express();

/**
 * Configure Auto-Launch (run on startup)
 * This works for the packaged .exe / .app
 */
/**
 * Auto-Launch Cleanup
 * Ensures that any old auto-start entries are removed.
 */
async function cleanupAutoLaunch() {
  if (process.env.NODE_ENV === 'development') return;

  const agentLauncher = new AutoLaunch({
    name: 'CheckAm Agent',
    path: process.execPath,
  });

  try {
    const isEnabled = await agentLauncher.isEnabled();
    if (isEnabled) {
      await agentLauncher.disable();
      console.log('🧹 Auto-launch disabled: CheckAm Agent will no longer start on login');
    }
  } catch (err) {
    // Gracefully ignore errors
  }
}

// Run cleanup on startup to fix "old" users who have auto-start enabled
cleanupAutoLaunch().catch(() => {});


const PORT   = parseInt(process.env.PORT || '47291', 10);
const PLATFORM = process.platform; // 'win32' | 'darwin' | 'linux'

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allow requests from the CheckAm website and local dev servers.
const ALLOWED_ORIGINS = [
  'https://checkamm.com',
  'https://www.checkamm.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman) and any localhost port
    if (!origin || ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CheckAm Agent`));
    }
  },
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// ── Storage reader (cached for 10 minutes) ───────────────────────────────────
let storageCache: { data: StorageData; expires: number } | null = null;

async function readStorage(): Promise<StorageData> {
  const now = Date.now();
  if (storageCache && now < storageCache.expires) {
    console.log('💾 Returning cached storage data');
    return storageCache.data;
  }
  if (PLATFORM === 'win32')  { const d = await getWindowsStorage(); storageCache = { data: d, expires: now + 10 * 60 * 1000 }; return d; }
  if (PLATFORM === 'darwin') { const d = await getMacStorage();     storageCache = { data: d, expires: now + 10 * 60 * 1000 }; return d; }
  throw new Error(`Unsupported platform: ${PLATFORM}.`);
}

// ── Battery reader (cached for 5 minutes) ────────────────────────────────────
let batteryCache: { data: BatteryData; expires: number } | null = null;

async function readBattery(): Promise<BatteryData> {
  const now = Date.now();
  if (batteryCache && now < batteryCache.expires) {
    console.log('🔋 Returning cached battery data');
    return batteryCache.data;
  }
  if (PLATFORM === 'win32')  { const d = await getWindowsBattery(); batteryCache = { data: d, expires: now + 5 * 60 * 1000 }; return d; }
  if (PLATFORM === 'darwin') { const d = await getMacBattery();     batteryCache = { data: d, expires: now + 5 * 60 * 1000 }; return d; }
  throw new Error(`Unsupported platform: ${PLATFORM}. CheckAm Agent supports Windows and macOS.`);
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /ping — website uses this to detect if the agent is running */
app.get('/ping', (_req: Request, res: Response) => {
  res.json({
    ok:       true,
    agent:    'checkam-agent',
    version:  AGENT_VERSION,
    platform: PLATFORM === 'win32' ? 'windows' : PLATFORM === 'darwin' ? 'mac' : PLATFORM,
  });
});

/** GET /battery[?sessionId=xxx] — read battery data, optionally submit to backend */
app.get('/battery', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;

  let data: BatteryData;
  try {
    console.log('🔋 Reading battery data...');
    data = await readBattery();
    console.log(`✅ Battery health: ${data.health}% | Cycles: ${data.cycleCount ?? 'N/A'}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error reading battery';
    console.error('❌ Battery read failed:', message);
    res.status(500).json({ success: false, error: message });
    return;
  }

  // Fire-and-forget backend submission if sessionId provided
  if (sessionId) {
    submitBatterySession(sessionId, data)
      .then(() => console.log(`📡 Session ${sessionId} fulfilled`))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('⚠️  Failed to submit session:', msg);
      });
  }

  res.json({
    success: true,
    data: {
      health:              data.health,
      cycleCount:          data.cycleCount,
      designCapacity:      data.designCapacity,
      fullChargeCapacity:  data.fullChargeCapacity,
      platform:            data.platform,
      unit:                data.unit,
    },
  });
});

/** GET /storage — read disk health data */
app.get('/storage', async (_req: Request, res: Response) => {
  let data: StorageData;
  try {
    console.log('💾 Reading storage data...');
    data = await readStorage();
    console.log(`✅ ${data.disks.length} disk(s) found`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error reading storage';
    console.error('❌ Storage read failed:', message);
    res.status(500).json({ success: false, error: message });
    return;
  }
  res.json({ success: true, data });
});

/** GET /shutdown — shut down agent and delete executable */
app.get('/shutdown', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Agent is shutting down and removing itself.' });
  
  const exePath = process.execPath;
  const isPackaged = !process.env.NODE_ENV || process.env.NODE_ENV === 'production';

  setTimeout(() => {
    if (isPackaged) {
      const { spawn } = require('child_process');
      if (process.platform === 'win32') {
        spawn('cmd.exe', ['/c', `timeout /t 2 > nul && del /f /q "${exePath}"`], {
          detached: true,
          stdio: 'ignore'
        }).unref();
      } else {
        spawn('sh', ['-c', `sleep 2 && rm -f "${exePath}"`], {
          detached: true,
          stdio: 'ignore'
        }).unref();
      }
    }
    process.exit(0);
  }, 1000);
});


// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ success: false, error: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, '127.0.0.1', () => {
  const platformLabel = PLATFORM === 'win32' ? 'Windows' : PLATFORM === 'darwin' ? 'macOS' : PLATFORM;
  console.log('');
  console.log('  ┌─────────────────────────────────────────┐');
  console.log(`  │  CheckAm Agent v${AGENT_VERSION} — ${platformLabel.padEnd(15)}  │`);
  console.log(`  │  Listening on http://localhost:${PORT}  │`);
  console.log('  │  Ready for checkamm.com requests        │');
  console.log('  └─────────────────────────────────────────┘');
  console.log('');
});

// If another instance is already running, exit cleanly (code 0).
// Exit code 0 = "success" — Windows Task Scheduler will NOT retry it,
// which stops the repeated launch loop on startup.
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    process.exit(0);
  }
  throw err;
});

export default app;
