const fs = require('fs');
const path = require('path');

// Read the register module to find cache logic
const registerPath = require.resolve('./node_modules/tsx/dist/register-BOkp8V6j.cjs');
console.log('register path:', registerPath);

const content = fs.readFileSync(registerPath, 'utf8');

// Search for cache-related code
const cacheMatches = content.match(/cache|Cache|CACHE/g);
console.log('cache mentions:', cacheMatches ? cacheMatches.length : 0);

// Search for temp directory or cache directory
const tempMatches = content.match(/temp|tmp|cache|directory/gi);
console.log('temp/dir mentions:', tempMatches ? tempMatches.length : 0);

// Print lines containing cache
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.match(/cache|Cache|temp|tmp|directory|esbuild/gi)) {
    console.log(`Line ${i}: ${line.substring(0, 100)}`);
  }
});
