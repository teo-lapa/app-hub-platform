import re

# Read the temp file
with open('page_temp.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove getAnimationProps calls (multiline aware)
content = re.sub(r'\{\.\.\getAnimationProps\([^)]*\)\}', '', content, flags=re.DOTALL)

# Remove whileHover, whileTap attributes
content = re.sub(r'\{\.\.\.\(performanceMode \? \{\} : \{ whileHover: \{ scale: [^}]+ \}, whileTap: \{ scale: [^}]+ \} \}\)\}', '', content)

# Remove individual motion attributes like animate, initial, exit, transition
content = re.sub(r'\s*initial=\{[^}]*\}', '', content)
content = re.sub(r'\s*animate=\{[^}]*\}', '', content)
content = re.sub(r'\s*exit=\{[^}]*\}', '', content)
content = re.sub(r'\s*transition=\{[^}]*\}', '', content)

# Remove AnimatePresence tags
content = content.replace('<AnimatePresence>', '')
content = content.replace('</AnimatePresence>', '')

# Add CSS classes where removed animations
# Add fade-in to divs that had initial animation
lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    # If we see a div that likely had animations (empty {...})
    if '<div' in line and line.strip().endswith('>') and i > 0:
        # Check if previous context suggests it should have animation class
        if any(keyword in lines[max(0, i-3):i] for keyword in ['showZoneSelector', 'showLocationList', 'showOperations', 'showBatchSelector']):
            line = line.replace('className="', 'className="slide-in-right ')
    new_lines.append(line)

content = '\n'.join(new_lines)

# Write the cleaned file
with open('../page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("File cleaned successfully!")
