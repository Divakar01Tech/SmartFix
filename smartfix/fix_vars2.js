const fs = require('fs');
const path = require('path');

function fixInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (['node_modules', '.git', 'dist', 'package-lock.json', 'fix_vars2.js'].includes(file)) continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixInDir(fullPath);
    } else {
      if (['.js', '.jsx'].includes(path.extname(fullPath))) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let modified = false;

        if (content.includes('Tamil NaduLocation')) {
          content = content.replaceAll('Tamil NaduLocation', 'TamilNaduLocation');
          modified = true;
        }

        if (modified) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`Fixed variables in ${fullPath}`);
        }
      }
    }
  }
}

fixInDir(process.cwd());
console.log("Fix complete!");
