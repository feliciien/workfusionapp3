with open('src/lib/workfusion/prop-firm/evaluation-engine.ts', 'r') as f:
    content = f.read()

# Find the second 'return {' (should be createFundedAccount) and add accountType
# We already fixed the first one, so find the next one that has 'fund_' after it
# Let's find by looking for 'return { id: und_' pattern
import re

# Replace the return for fund_
content = content.replace(
    'return {\n      id: und_',
    'return {\n      accountType: \
FUNDED\,\n      id: und_'
)

with open('src/lib/workfusion/prop-firm/evaluation-engine.ts', 'w') as f:
    f.write(content)
print('Done!')
