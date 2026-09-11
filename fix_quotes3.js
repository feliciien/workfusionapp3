const fs = require('fs');
const content = fs.readFileSync('src/lib/workfusion/prop-firm/evaluation-engine.ts', 'utf8');
const fixed = content
    .replace('accountType: \\\\ CHALLENGE \\\\,', 'accountType: \
CHALLENGE\,')
    .replace('accountType: \\\\FUNDED \\\\,', 'accountType: \FUNDED\,');
fs.writeFileSync('src/lib/workfusion/prop-firm/evaluation-engine.ts', fixed);
console.log('Done');
