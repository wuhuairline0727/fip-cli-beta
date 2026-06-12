import * as fs from 'fs';
import * as path from 'path';
import { screenshot } from './browser';

let screenshotOnError = true;
let screenshotDir = path.join(process.cwd(), 'screenshots');
const MAX_SCREENSHOTS = 50;
const SCREENSHOT_MAX_AGE_DAYS = 30;

function cleanupScreenshots(): void {
  try {
    if (!fs.existsSync(screenshotDir)) return;
    const files = fs
      .readdirSync(screenshotDir)
      .filter((f) => f.endsWith('.png'))
      .map((f) => {
        const filepath = path.join(screenshotDir, f);
        return {
          name: f,
          path: filepath,
          mtime: fs.statSync(filepath).mtimeMs,
        };
      })
      .sort((a, b) => a.mtime - b.mtime);

    const now = Date.now();
    const maxAgeMs = SCREENSHOT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    // Delete old files by age
    for (const file of files) {
      if (now - file.mtime > maxAgeMs) {
        fs.unlinkSync(file.path);
      }
    }

    // Delete oldest if still over limit
    const remaining = files.filter((f) => fs.existsSync(f.path));
    while (remaining.length > MAX_SCREENSHOTS) {
      const oldest = remaining.shift();
      if (oldest) fs.unlinkSync(oldest.path);
    }
  } catch (_e) {
    // Silently fail on cleanup error
  }
}

export interface ScreenshotOptions {
  screenshotOnError?: boolean;
  screenshotDir?: string;
}

export interface ScreenshotResult {
  ok: boolean;
  data?: {
    path?: string;
    data?: string;
  };
}

export function setScreenshotOptions(options: ScreenshotOptions): void {
  if (options.screenshotOnError !== undefined)
    screenshotOnError = options.screenshotOnError;
  if (options.screenshotDir) screenshotDir = options.screenshotDir;
}

export async function takeErrorScreenshot(
  errorCode: string
): Promise<string | null> {
  if (!screenshotOnError) return null;
  cleanupScreenshots();
  try {
    const result = (await screenshot('png')) as ScreenshotResult;
    if (!result.ok || !result.data) return null;

    const srcPath = result.data.path;
    if (srcPath && fs.existsSync(srcPath)) {
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const filename = `error_${errorCode}_${Date.now()}.png`;
      const filepath = path.join(screenshotDir, filename);
      fs.copyFileSync(srcPath, filepath);
      return filepath;
    }

    if (result.data.data) {
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const filename = `error_${errorCode}_${Date.now()}.png`;
      const filepath = path.join(screenshotDir, filename);
      fs.writeFileSync(filepath, Buffer.from(result.data.data, 'base64'));
      return filepath;
    }
  } catch (_e) {
    // Silently fail on screenshot error
  }
  return null;
}

export function success(data: unknown): void {
  console.log(JSON.stringify({ ok: true, data }, null, 2));
}

export interface FipError extends Error {
  code: string;
  isFipError: boolean;
}

export async function error(code: string, message: string): Promise<never> {
  const screenshotPath = await takeErrorScreenshot(code);
  const output: Record<string, unknown> = {
    ok: false,
    error: { code, message },
  };
  if (screenshotPath) {
    output.screenshot = screenshotPath;
  }
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = 1;
  const err = new Error(message) as FipError;
  err.code = code;
  err.isFipError = true;
  throw err;
}
