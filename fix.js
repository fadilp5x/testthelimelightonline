const fs = require('fs');
const path = 'C:/Users/MPC/OneDrive/Tài liệu/fadil/2026/website for limelight/testthelimelightonline-main/testthelimelightonline-main/build.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\\\`/g, '`');
content = content.replace(/\\\${/g, '${');
content = content.replace(/\\\\n/g, '\\n');
fs.writeFileSync(path, content);
console.log('Fixed build.js');
