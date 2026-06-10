const fs = require('fs');
const path = require('path');

let debugMode = false;
let verboseMode = false;
const LOG_FILE = path.join(process.cwd(), 'fip-debug.log');

function setDebug(mode) {
  debugMode = mode;
}
function setVerbose(mode) {
  verboseMode = mode;
}

function debug(...args) {
  if (debugMode) {
    const line = `[DEBUG] ${new Date().toISOString()} ${args.join(' ')}`;
    console.error(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
  }
}

function verbose(...args) {
  if (verboseMode || debugMode) {
    const line = `[INFO] ${new Date().toISOString()} ${args.join(' ')}`;
    console.error(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
  }
}

function log(...args) {
  console.log(...args);
}

module.exports = { setDebug, setVerbose, debug, verbose, log };
