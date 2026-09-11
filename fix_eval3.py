with open('src/lib/workfusion/prop-firm/evaluation-engine.ts', 'r') as f:
    content = f.read()

# Fix both return statements - use count=1 to replace only first occurrence each time
content = content.replace(
    'return {',
    'return { accountType: \
CHALLENGE\,',
    1
)
content = content.replace(
    'return {',
    'return { accountType: \FUNDED\,',
    1
)

with open('src/lib/workfusion/prop-firm/evaluation-engine.ts', 'w') as f:
    f.write(content)
print('Done!')
