#!/usr/bin/env node
/**
 * Script pour comparer routes.code.json avec routes.runtime.json
 * Usage: node scripts/compare_routes.js > routes.diff.md
 */
const fs = require('fs');
const path = require('path');

const codeRoutesFile = path.join(__dirname, '..', 'routes.code.json');
const runtimeRoutesFile = path.join(__dirname, '..', 'routes.runtime.json');

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Error reading ${filePath}: ${error.message}`);
    return null;
  }
}

function normalizeRoute(route) {
  // Normaliser le chemin (supprimer trailing slash pour comparaison)
  let normalizedPath = route.path || route.path;
  const method = (route.method || route.methods?.[0] || '').toUpperCase();
  
  return {
    path: normalizedPath,
    method: method,
    key: `${method} ${normalizedPath}`,
    original: route
  };
}

function compareRoutes() {
  const codeData = loadJSON(codeRoutesFile);
  const runtimeData = loadJSON(runtimeRoutesFile);
  
  if (!codeData) {
    console.error('Error: routes.code.json not found. Run scripts/extract_code_routes.js first.');
    process.exit(1);
  }
  
  const codeRoutes = new Map();
  const runtimeRoutes = new Map();
  
  // Indexer les routes du code
  if (codeData.routes) {
    codeData.routes.forEach(route => {
      const normalized = normalizeRoute(route);
      codeRoutes.set(normalized.key, normalized);
    });
  }
  
  // Indexer les routes runtime si disponibles
  if (runtimeData && runtimeData.routes) {
    runtimeData.routes.forEach(route => {
      const normalized = normalizeRoute(route);
      runtimeRoutes.set(normalized.key, normalized);
    });
  }
  
  // Routes présentes dans le code mais pas au runtime
  const onlyInCode = [];
  codeRoutes.forEach((route, key) => {
    if (!runtimeRoutes.has(key)) {
      onlyInCode.push(route);
    }
  });
  
  // Routes présentes au runtime mais pas dans le code
  const onlyInRuntime = [];
  if (runtimeData) {
    runtimeRoutes.forEach((route, key) => {
      if (!codeRoutes.has(key)) {
        onlyInRuntime.push(route);
      }
    });
  }
  
  // Générer le rapport
  let report = `# Comparaison des Routes API\n\n`;
  report += `**Généré le**: ${new Date().toISOString()}\n\n`;
  
  report += `## Résumé\n\n`;
  report += `- Routes dans le code: ${codeRoutes.size}\n`;
  if (runtimeData) {
    report += `- Routes au runtime: ${runtimeRoutes.size}\n`;
    report += `- Routes seulement dans le code: ${onlyInCode.length}\n`;
    report += `- Routes seulement au runtime: ${onlyInRuntime.length}\n`;
  } else {
    report += `- Routes au runtime: **NON DISPONIBLE** (routes.runtime.json non trouvé)\n`;
    report += `  → Exécutez: cd backend && python scripts/print_routes.py > ../../routes.runtime.json\n\n`;
  }
  
  // Routes clés attendues (stores, manager, seller)
  const expectedRoutes = [
    { method: 'POST', path: '/api/stores/' },
    { method: 'GET', path: '/api/stores/my-stores' },
    { method: 'GET', path: '/api/stores/{store_id}/info' },
    { method: 'GET', path: '/api/manager/subscription-status' },
    { method: 'GET', path: '/api/manager/store-kpi-overview' },
    { method: 'GET', path: '/api/manager/dates-with-data' },
    { method: 'GET', path: '/api/manager/available-years' },
    { method: 'GET', path: '/api/seller/subscription-status' },
    { method: 'GET', path: '/api/seller/kpi-enabled' },
    { method: 'GET', path: '/api/seller/tasks' },
    { method: 'GET', path: '/api/seller/objectives/active' },
    { method: 'GET', path: '/api/seller/objectives/all' },
  ];
  
  report += `\n## Routes Clés Attendues (Stores/Manager/Seller)\n\n`;
  report += `| Method | Path | Dans Code | Au Runtime | Status |\n`;
  report += `|--------|------|-----------|------------|--------|\n`;
  
  expectedRoutes.forEach(expected => {
    const codeKey = `${expected.method} ${expected.path}`;
    const codeFound = codeRoutes.has(codeKey);
    const runtimeFound = runtimeData ? runtimeRoutes.has(codeKey) : null;
    
    let status = '❌';
    if (codeFound && (runtimeFound !== false)) {
      status = '✅';
    } else if (codeFound) {
      status = '⚠️ (code seulement)';
    }
    
    report += `| ${expected.method} | \`${expected.path}\` | ${codeFound ? '✅' : '❌'} | ${runtimeFound === null ? 'N/A' : (runtimeFound ? '✅' : '❌')} | ${status} |\n`;
  });
  
  if (onlyInCode.length > 0) {
    report += `\n## Routes Présentes dans le Code mais Absentes au Runtime\n\n`;
    onlyInCode.forEach(route => {
      report += `- \`${route.method} ${route.path}\` (${route.original.file || 'unknown'})\n`;
    });
  }
  
  if (onlyInRuntime.length > 0) {
    report += `\n## Routes Présentes au Runtime mais Absentes du Code\n\n`;
    report += `> ⚠️ Ces routes sont exposées mais ne sont pas trouvées dans le code source.\n\n`;
    onlyInRuntime.forEach(route => {
      report += `- \`${route.method} ${route.path}\`\n`;
    });
  }
  
  // Routes dépréciées (/api/integrations/*)
  report += `\n## Routes Dépréciées (/api/integrations/*)\n\n`;
  report += `| Method | Path | Status |\n`;
  report += `|--------|------|--------|\n`;
  
  codeRoutes.forEach((route, key) => {
    if (route.path.includes('/api/integrations/')) {
      report += `| ${route.method} | \`${route.path}\` | ⚠️ Déprécié |\n`;
    }
  });
  
  console.log(report);
}

compareRoutes();

