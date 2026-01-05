/**
 * Script pour remplacer process.env.REACT_APP_BACKEND_URL par API_BASE
 * Usage: node scripts/replace-api-urls.js
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const API_LIB_PATH = 'lib/api';

// Fonction pour calculer le chemin relatif vers lib/api
function getRelativePathToApi(filePath) {
  const relative = path.relative(path.dirname(filePath), path.join(SRC_DIR, API_LIB_PATH));
  return relative.startsWith('.') ? relative : `./${relative}`;
}

// Fonction pour normaliser les chemins (Windows/Unix)
function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let modified = false;
  
  // Vérifier si le fichier utilise REACT_APP_BACKEND_URL
  if (!content.includes('REACT_APP_BACKEND_URL')) {
    return false;
  }
  
  // Vérifier si l'import existe déjà
  const hasImport = content.includes("from '") && content.includes("lib/api") ||
                    content.includes('from "') && content.includes('lib/api');
  
  if (!hasImport) {
    // Trouver la dernière ligne d'import
    const lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith("import ")) {
        lastImportIndex = i;
      } else if (lastImportIndex >= 0 && lines[i].trim() === '') {
        // Arrêter après la première ligne vide après les imports
        break;
      }
    }
    
    // Ajouter l'import après le dernier import
    const relativePath = getRelativePathToApi(filePath);
    const normalizedPath = normalizePath(relativePath);
    const importLine = `import { API_BASE } from '${normalizedPath}';`;
    
    if (lastImportIndex >= 0) {
      lines.splice(lastImportIndex + 1, 0, importLine);
      newContent = lines.join('\n');
      modified = true;
    }
  }
  
  // Remplacer les patterns
  // Pattern 1: const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  if (newContent.includes('const BACKEND_URL = process.env.REACT_APP_BACKEND_URL')) {
    newContent = newContent.replace(
      /const BACKEND_URL = process\.env\.REACT_APP_BACKEND_URL;?/g,
      'const BACKEND_URL = API_BASE;'
    );
    modified = true;
  }
  
  // Pattern 2: const API = process.env.REACT_APP_BACKEND_URL;
  if (newContent.includes('const API = process.env.REACT_APP_BACKEND_URL')) {
    newContent = newContent.replace(
      /const API = process\.env\.REACT_APP_BACKEND_URL(\s*\|\|.*?)?;?/g,
      (match, fallback) => {
        // Si pas de fallback, utiliser API_BASE directement
        if (!fallback || fallback.trim() === '') {
          return 'const API = API_BASE;';
        }
        // Si fallback, utiliser API_BASE avec le même fallback
        return `const API = API_BASE${fallback};`;
      }
    );
    modified = true;
  }
  
  // Pattern 3: process.env.REACT_APP_BACKEND_URL utilisé directement dans les appels
  // On le laisse pour l'instant car plus complexe à remplacer
  
  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return true;
  }
  
  return false;
}

// Fonction récursive pour parcourir les fichiers
function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && file !== 'node_modules' && file !== '.git') {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Exécuter le script
console.log('Recherche des fichiers à modifier...');
const files = walkDir(SRC_DIR);
console.log(`Trouvé ${files.length} fichiers JavaScript`);

let modifiedCount = 0;
files.forEach(file => {
  if (processFile(file)) {
    console.log(`✓ Modifié: ${path.relative(SRC_DIR, file)}`);
    modifiedCount++;
  }
});

console.log(`\nTerminé! ${modifiedCount} fichiers modifiés.`);

