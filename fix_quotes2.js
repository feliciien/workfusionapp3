const fs = require('fs');
const content = fs.readFileSync('src/lib/workfusion/prop-firm/evaluation-engine.ts', 'utf8');
const fixed = content
    .replace(/accountType: CHALLENGE,/g, 'accountType: \
CHALLENGE\,')
    .replace(/accountType: FUNDED,/g, 'accountType: \FUNDED\,');
fs.writeFileSync('src/lib/workfusion/prop-firm/evaluation-engine.ts', fixed);
console.log('Done');
