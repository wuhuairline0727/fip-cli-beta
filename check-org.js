const orgPath = require.resolve('./lib/utils/organization');
console.log('organization path:', orgPath);

const dialogPath = require.resolve('./lib/utils/organization/dialog');
console.log('dialog path:', dialogPath);

const fs = require('fs');
const dialogContent = fs.readFileSync(dialogPath, 'utf8');

// Check if .Menu_Item is in the file
const hasMenuItem = dialogContent.includes('.Menu_Item');
console.log('has .Menu_Item:', hasMenuItem);

// Check the closest line
const lines = dialogContent.split('\n');
lines.forEach((line, i) => {
  if (line.includes('closest')) {
    console.log(`Line ${i}: ${line.trim()}`);
  }
});
