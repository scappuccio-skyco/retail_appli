/**
 * Script pour vérifier qu'il n'y a pas d'URLs en dur de l'ancien backend
 * Usage: node scripts/lint-urls.js
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const OLD_URL_PATTERNS = [
  /https?:\/\/retailperformerai\.com\/api\//, // Ancien pattern (sans api. au début)
  /up\.railway\.app/,
];

let foundIssues = false;

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && file !== 'node_modules' && file !== '.git' && file !== 'build') {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

console.log('Recherche des URLs en dur...\n');
const files = walkDir(SRC_DIR);

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(SRC_DIR, file);
  
  OLD_URL_PATTERNS.forEach(pattern => {
    if (pattern.test(content)) {
      console.error(`❌ Found old URL in: ${relativePath}`);
      foundIssues = true;
    }
  });
});

if (foundIssues) {
  console.error('\n❌ Des URLs en dur ont été trouvées. Utilisez API_BASE depuis lib/api.js');
  process.exit(1);
} else {
  console.log('✅ OK: no hardcoded old URLs');
}

