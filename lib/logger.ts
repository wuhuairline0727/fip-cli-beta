import * as fs from 'fs';
import * as path from 'path';

let debugMode = false;
let verboseMode = false;
const LOG_FILE: string = path.join(process.cwd(), 'fip-debug.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_LINES = 5000;

function cleanupLog(): void {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const stats = fs.statSync(LOG_FILE);
    if (stats.size < MAX_LOG_SIZE) return;
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n');
    if (lines.length <= MAX_LOG_LINES) return;
    const trimmed = lines.slice(-MAX_LOG_LINES).join('\n');
    fs.writeFileSync(LOG_FILE, trimmed, 'utf-8');
  } catch (_e) {
    // Silently fail on cleanup error
  }
}

export function setDebug(mode: boolean): void {
  debugMode = mode;
}

export function setVerbose(mode: boolean): void {
  verboseMode = mode;
}

export function debug(...args: unknown[]): void {
  if (debugMode) {
    cleanupLog();
    const line = `[DEBUG] ${new Date().toISOString()} ${args.join(' ')}`;
    console.error(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
  }
}

export function verbose(...args: unknown[]): void {
  if (verboseMode || debugMode) {
    cleanupLog();
    const line = `[INFO] ${new Date().toISOString()} ${args.join(' ')}`;
    console.error(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
  }
}

export function log(...args: unknown[]): void {
  console.log(...args);
}
