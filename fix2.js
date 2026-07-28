const fs = require('fs');
const path = 'C:/Users/MPC/OneDrive/Tài liệu/fadil/2026/website for limelight/testthelimelightonline-main/testthelimelightonline-main/build.js';
let content = fs.readFileSync(path, 'utf8');

// Replace any corrupted styleRegex line
content = content.replace(/const styleRegex = \/<style\[\^>\]\*>.*\/gi;/g, 'const styleRegex = /<style[^>]*>([\\\\s\\\\S]*?)<\\\\/style>/gi;');

fs.writeFileSync(path, content);
console.log('Fixed styleRegex');
