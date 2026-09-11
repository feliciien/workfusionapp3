with open('src/lib/workfusion/prop-firm/evaluation-engine.ts', 'r') as f:
    content = f.read()

# Fix the accountType strings
content = content.replace('accountType: CHALLENGE,', 'accountType: \
CHALLENGE\,')
content = content.replace('accountType: FUNDED,', 'accountType: \FUNDED\,')

with open('src/lib/workfusion/prop-firm/evaluation-engine.ts', 'w') as f:
    f.write(content)
print('Done!')
