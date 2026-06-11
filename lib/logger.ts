import * as fs from 'fs';
import * as path from 'path';

let debugMode = false;
let verboseMode = false;
const LOG_FILE: string = path.join(process.cwd(), 'fip-debug.log');

export function setDebug(mode: boolean): void {
  debugMode = mode;
}

export function setVerbose(mode: boolean): void {
  verboseMode = mode;
}

export function debug(...args: unknown[]): void {
  if (debugMode) {
    const line = `[DEBUG] ${new Date().toISOString()} ${args.join(' ')}`;
    console.error(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
  }
}

export function verbose(...args: unknown[]): void {
  if (verboseMode || debugMode) {
    const line = `[INFO] ${new Date().toISOString()} ${args.join(' ')}`;
    console.error(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
  }
}

export function log(...args: unknown[]): void {
  console.log(...args);
}
