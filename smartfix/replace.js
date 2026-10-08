const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (['node_modules', '.git', 'dist', 'package-lock.json'].includes(file)) continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else {
      if (['.js', '.jsx', '.html', '.md', '.json', '.css'].includes(path.extname(fullPath))) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let modified = false;
        if (content.includes('SmartFix')) {
          content = content.replace(/SmartFix/g, 'SmartFix');
          modified = true;
        }
        if (content.includes('Tamil Nadu')) {
          content = content.replace(/Tamil Nadu/gi, 'Tamil Nadu');
          modified = true;
        }
        if (content.includes('Tamil Nadu')) {
          content = content.replace(/Tamil Nadu/gi, 'Tamil Nadu');
          modified = true;
        }
        if (content.includes('Tamil Nadu')) {
          content = content.replace(/Tamil Nadu/gi, 'Tamil Nadu');
          modified = true;
        }
        if (content.includes('Tamil Nadu')) {
          content = content.replace(/Tamil Nadu/gi, 'tamilnadu');
          modified = true;
        }
        if (modified) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`Updated ${fullPath}`);
        }
      }
    }
  }
}

replaceInDir(process.cwd());
