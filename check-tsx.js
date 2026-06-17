const tsx = require.resolve('tsx/cjs');
console.log('tsx path:', tsx);
const fs = require('fs');
const content = fs.readFileSync(tsx, 'utf8');
console.log(content.substring(0, 800));
