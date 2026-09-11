with open('src/lib/workfusion/prop-firm/evaluation-engine.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if i == 433 and 'return {' in line and line.strip() == 'return {':
        new_lines.append('    return { accountType: \
CHALLENGE\,\n')
    elif i == 487 and 'return {' in line and line.strip() == 'return {':
        new_lines.append('    return { accountType: \FUNDED\,\n')
    else:
        new_lines.append(line)

with open('src/lib/workfusion/prop-firm/evaluation-engine.ts', 'w') as f:
    f.writelines(new_lines)
print('Done!')
