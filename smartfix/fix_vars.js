const fs = require('fs');
const path = require('path');

function fixInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (['node_modules', '.git', 'dist', 'package-lock.json'].includes(file)) continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixInDir(fullPath);
    } else {
      if (['.js', '.jsx'].includes(path.extname(fullPath))) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let modified = false;

        const replacements = {
          'TAMILNADU_TALUKS': 'TAMILNADU_TALUKS',
          'TAMILNADU_BOUNDS': 'TAMILNADU_BOUNDS',
          'isTamilNadu': 'isTamilNadu',
          'TAMILNADU_CENTER': 'TAMILNADU_CENTER',
          'TAMILNADU_ALIASES': 'TAMILNADU_ALIASES'
        };

        for (const [key, val] of Object.entries(replacements)) {
          if (content.includes(key)) {
            content = content.replaceAll(key, val);
            modified = true;
          }
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
