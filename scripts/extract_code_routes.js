#!/usr/bin/env node
/**
 * Script pour extraire les routes depuis le code source (grep sur @router.*)
 * Usage: node scripts/extract_code_routes.js > routes.code.json
 */
const fs = require('fs');
const path = require('path');

const backendRoutesDir = path.join(__dirname, '..', 'backend', 'api', 'routes');

if (!fs.existsSync(backendRoutesDir)) {
  console.error(`Error: ${backendRoutesDir} does not exist`);
  process.exit(1);
}

const routerPrefixPattern = /router\s*=\s*APIRouter\([^)]*prefix\s*=\s*["']([^"']+)["']/s;
const routeDecoratorPattern = /@router\.(get|post|put|delete|patch)\(["']([^"']+)["']/gi;

function extractRoutesFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extraire le prefix du router
    const prefixMatch = content.match(routerPrefixPattern);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    
    const routes = [];
    let match;
    
    // Réinitialiser le regex pour chaque fichier
    const pattern = new RegExp(routeDecoratorPattern.source, routeDecoratorPattern.flags);
    
    while ((match = pattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      
      // Construire le chemin complet
      let fullPath = `/api${prefix}${routePath}`;
      // Normaliser les doubles slashes
      fullPath = fullPath.replace(/\/+/g, '/');
      
      const relativePath = path.relative(path.join(__dirname, '..'), filePath);
      
      routes.push({
        path: fullPath,
        method: method,
        file: relativePath.replace(/\\/g, '/'),
        prefix: prefix,
        route_path: routePath,
      });
    }
    
    return routes;
  } catch (error) {
    console.error(`Error reading ${filePath}: ${error.message}`, { output: 'stderr' });
    return [];
  }
}

const allRoutes = [];

// Parcourir tous les fichiers Python dans api/routes
const files = fs.readdirSync(backendRoutesDir);
for (const file of files) {
  if (file.startsWith('__') || !file.endsWith('.py')) {
    continue;
  }
  
  const filePath = path.join(backendRoutesDir, file);
  const routesInFile = extractRoutesFromFile(filePath);
  allRoutes.push(...routesInFile);
}

// Trier
allRoutes.sort((a, b) => {
  if (a.path !== b.path) {
    return a.path.localeCompare(b.path);
  }
  return a.method.localeCompare(b.method);
});

const output = {
  generated_at: new Date().toISOString(),
  source: 'code_extraction',
  total_routes: allRoutes.length,
  routes: allRoutes,
};

console.log(JSON.stringify(output, null, 2));

