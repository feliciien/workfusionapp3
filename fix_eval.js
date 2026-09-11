const fs = require('fs');
const content = fs.readFileSync('src/lib/workfusion/prop-firm/evaluation-engine.ts', 'utf8');
const lines = content.split('\n');

// Fix createChallengeAccount return at line 434
lines[434] = '    return { accountType: \
CHALLENGE\,';

// Fix createFundedAccount return at line 490
lines[490] = '    return { accountType: \FUNDED\,';

fs.writeFileSync('src/lib/workfusion/prop-firm/evaluation-engine.ts', lines.join('\n'));
console.log('Done!');
