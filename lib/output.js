const fs = require('fs');
const path = require('path');
const { screenshot } = require('./browser');

let screenshotOnError = true;
let screenshotDir = path.join(process.cwd(), 'screenshots');

function setScreenshotOptions(options) {
  if (options.screenshotOnError !== undefined) screenshotOnError = options.screenshotOnError;
  if (options.screenshotDir) screenshotDir = options.screenshotDir;
}

async function takeErrorScreenshot(errorCode) {
  if (!screenshotOnError) return null;
  try {
    const result = await screenshot('png');
    if (!result.ok || !result.data) return null;

    // WebBridge screenshot 返回文件路径，需要读取文件
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

    // 兼容旧版 base64 返回格式
    if (result.data.data) {
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const filename = `error_${errorCode}_${Date.now()}.png`;
      const filepath = path.join(screenshotDir, filename);
      fs.writeFileSync(filepath, Buffer.from(result.data.data, 'base64'));
      return filepath;
    }
  } catch (e) {
    // Silently fail on screenshot error
  }
  return null;
}

function success(data) {
  console.log(JSON.stringify({ ok: true, data }, null, 2));
}

async function error(code, message) {
  const screenshotPath = await takeErrorScreenshot(code);
  const output = { ok: false, error: { code, message } };
  if (screenshotPath) {
    output.screenshot = screenshotPath;
  }
  console.log(JSON.stringify(output, null, 2));
  const err = new Error(message);
  err.code = code;
  err.isFipError = true;
  throw err;
}

module.exports = { success, error, setScreenshotOptions, takeErrorScreenshot };
