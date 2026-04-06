/**
 * Pre-render script — injecte le HTML de la landing page dans build/index.html
 * Exécuté après `vite build` via le script "build" de package.json
 *
 * Étapes :
 *  1. Build SSR → dist-server/entry-server.js
 *  2. Rendre la route "/" côté serveur (react-dom/server)
 *  3. Injecter le HTML rendu dans build/index.html
 *  4. Supprimer le dossier dist-server
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  // 1. Build SSR
  console.log('→ Pre-render : build SSR bundle...');
  execSync('npx vite build --ssr src/entry-server.js --outDir dist-server', {
    stdio: 'inherit',
    cwd: __dirname,
  });

  // 2. Importer le module SSR généré (pathToFileURL nécessaire sur Windows)
  const ssrEntry = pathToFileURL(path.resolve(__dirname, 'dist-server/entry-server.mjs')).href;
  const { render } = await import(ssrEntry);

  // 3. Lire build/index.html une seule fois comme template de base
  const templatePath = path.resolve(__dirname, 'build/index.html');
  const template = fs.readFileSync(templatePath, 'utf-8');

  if (!template.includes('<div id="root" translate="no"></div>')) {
    throw new Error('Marqueur <div id="root"> introuvable dans build/index.html — injection impossible.');
  }

  // 4. Pages à pre-rendre
  const pages = [
    { route: '/', output: 'build/index.html' },
    { route: '/blog/profil-disc-retail', output: 'build/blog/profil-disc-retail/index.html' },
    { route: '/blog/kpi-retail', output: 'build/blog/kpi-retail/index.html' },
  ];

  for (const page of pages) {
    const { html } = render(page.route);

    // Toujours utiliser le template original (avec le marqueur vide)
    const finalHtml = template.replace(
      '<div id="root" translate="no"></div>',
      `<div id="root" translate="no">${html}</div>`,
    );

    // Créer le dossier si nécessaire
    const outputPath = path.resolve(__dirname, page.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, finalHtml);
    console.log(`✓ Pre-render : ${page.route} → ${page.output}`);
  }

  console.log('✓ Pre-render terminé');

  // 6. Nettoyer le dossier SSR temporaire
  fs.rmSync(path.resolve(__dirname, 'dist-server'), { recursive: true, force: true });
  console.log('✓ dist-server supprimé');
} catch (err) {
  console.error('⚠ Pre-render échoué (le build reste valide sans pre-render) :', err.message);
  // Ne pas faire échouer le build Vercel — la SPA fonctionne sans pre-render
  process.exit(0);
}
