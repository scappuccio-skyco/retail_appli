#!/usr/bin/env node
/**
 * Script de lint pour vérifier l'absence d'URLs obsolètes dans la documentation
 * 
 * Usage: node scripts/lint-docs-urls.js
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// Patterns d'URLs obsolètes à détecter
const patterns = [
  /retailperformerai\.com\/api\/v1\/integrations/g,
  /retailappli-production\.up\.railway\.app/g,
  /https:\/\/retailperformerai\.com\/api\//g,  // URLs avec /api/ mais sans sous-domaine api.
  /BASE_URL\s*=\s*["']https:\/\/retailperformerai\.com/g,  // BASE_URL avec ancien format
];

// Exceptions autorisées (fichiers contenant ces patterns sont OK)
const allowedExceptions = [
  'DOCS_URL_INVENTORY_REPORT.md',  // Rapport d'inventaire lui-même
  'DEPRECATED_ENDPOINTS.md',  // Si un fichier liste les endpoints dépréciés
];

// Dossiers et fichiers à ignorer
const ignorePaths = [
  'node_modules',
  '.git',
  'build',
  'dist',
  '.next',
  'backups',
  'test_reports',
  'frontend/node_modules',
  'backend/__pycache__',
  'scripts',  // Ne pas linter les scripts eux-mêmes
];

// Extensions de fichiers à linter
const fileExtensions = ['.md', '.mdx', '.txt', '.yml', '.yaml', '.json'];

let foundErrors = false;
const errorFiles = [];

function shouldIgnore(filePath) {
  const relativePath = path.relative(rootDir, filePath);
  
  // Vérifier les exceptions autorisées
  const fileName = path.basename(filePath);
  if (allowedExceptions.includes(fileName)) {
    return true;
  }
  
  // Vérifier les dossiers à ignorer
  for (const ignorePath of ignorePaths) {
    if (relativePath.startsWith(ignorePath) || relativePath.includes(`/${ignorePath}/`) || relativePath.includes(`\\${ignorePath}\\`)) {
      return true;
    }
  }
  
  return false;
}

function lintFile(filePath) {
  if (shouldIgnore(filePath)) {
    return;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        errorFiles.push({
          file: filePath,
          pattern: pattern.toString()
        });
        foundErrors = true;
        break;
      }
    }
  } catch (error) {
    console.error(`Erreur lors de la lecture de ${filePath}: ${error.message}`);
  }
}

function walkDir(dir) {
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Ne pas descendre dans les dossiers ignorés
        const relativePath = path.relative(rootDir, filePath);
        if (!ignorePaths.some(ignore => relativePath.startsWith(ignore) || file === ignore)) {
          walkDir(filePath);
        }
      } else {
        // Vérifier l'extension
        const ext = path.extname(file);
        if (fileExtensions.includes(ext)) {
          lintFile(filePath);
        }
      }
    }
  } catch (error) {
    // Ignorer les erreurs d'accès (permissions, etc.)
    if (error.code !== 'EACCES' && error.code !== 'ENOENT') {
      console.error(`Erreur lors de la lecture du dossier ${dir}: ${error.message}`);
    }
  }
}

console.log('🔍 Recherche des URLs obsolètes dans la documentation...\n');

// Linter les fichiers à la racine et dans les dossiers de documentation
walkDir(rootDir);

if (foundErrors) {
  console.error('\n❌ Des URLs obsolètes ont été trouvées dans la documentation.\n');
  console.error('Utilisez la base URL: https://api.retailperformerai.com\n');
  console.error('Fichiers concernés:');
  errorFiles.forEach(({ file, pattern }) => {
    const relativePath = path.relative(rootDir, file);
    console.error(`  ❌ ${relativePath}`);
    console.error(`     Pattern détecté: ${pattern}`);
  });
  console.error('\n💡 Consultez DOCS_URL_INVENTORY_REPORT.md pour plus de détails.');
  console.error('💡 Consultez GUIDE_API_STORES.md, GUIDE_API_MANAGER.md, GUIDE_API_SELLER.md pour les nouveaux chemins.');
  process.exit(1);
} else {
  console.log('✅ OK: Aucune URL obsolète trouvée dans la documentation.');
  process.exit(0);
}

