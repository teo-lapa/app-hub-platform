const fs = require('fs');

// Read the temp file
let content = fs.readFileSync('page_temp.tsx', 'utf-8');

// Remove getAnimationProps calls
content = content.replace(/\{\s*\.\.\.\s*getAnimationProps\([^)]*\)\s*\}/gs, '');

// Remove whileHover, whileTap attributes
content = content.replace(/\{\.\.\.\(performanceMode \? \{\} : \{ whileHover: \{ scale: [^\}]+ \}, whileTap: \{ scale: [^\}]+ \} \}\)\}/g, '');

// Remove individual motion attributes
content = content.replace(/\s*initial=\{[^\}]*\}/g, '');
content = content.replace(/\s*animate=\{[^\}]*\}/g, '');
content = content.replace(/\s*exit=\{[^\}]*\}/g, '');
content = content.replace(/\s*transition=\{[^\}]*\}/g, '');

// Remove AnimatePresence tags
content = content.replace(/<AnimatePresence>/g, '');
content = content.replace(/<\/AnimatePresence>/g, '');

// Add CSS classes to sections
content = content.replace(/({showZoneSelector && \(\s*<div)/g, '$1 className="slide-in-right"');
content = content.replace(/({showLocationList && \(\s*<div)/g, '$1 className="slide-in-right"');
content = content.replace(/({showOperations && \(\s*<div)/g, '$1 className="slide-in-right"');

// Write back to page.tsx
fs.writeFileSync('page.tsx', content, 'utf-8');

console.log('✅ File cleaned successfully!');
