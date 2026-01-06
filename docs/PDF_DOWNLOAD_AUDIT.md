# Audit et Uniformisation des Téléchargements PDF

## Objectif

Vérifier que toutes les fonctionnalités de téléchargement PDF utilisent la même correction que celle faite pour le brief matinal et l'entretien, et uniformiser toutes les réponses PDF selon le même standard.

## Résultats de l'audit

### Frontend - Génération PDF côté client (html2canvas + jsPDF)

| Endroit (UI) | Fichier | Fonction | Pattern | Statut |
|--------------|---------|----------|---------|--------|
| Brief Matinal | `MorningBriefModal.js` | `exportBriefToPDF` | html2canvas + jsPDF (DOM snapshot) | ✅ OK |
| Entretien Annuel | `EvaluationGenerator.js` | `exportToPDF` | html2canvas + jsPDF (DOM snapshot) | ✅ OK |
| Bilan Performance | `PerformanceModal.js` | `exportToPDF` | html2canvas + jsPDF (DOM snapshot) | ✅ OK |
| Bilan Individuel | `BilanIndividuelModal.js` | `exportToPDF` | html2canvas + jsPDF (DOM snapshot) | ✅ OK |

**Tous les PDF générés côté client utilisent le pattern correct** : DOM snapshot avec `html2canvas` puis conversion en PDF avec `jsPDF`. Aucune corruption de caractères attendue.

### Frontend - Téléchargement PDF depuis backend

| Endroit (UI) | Fichier | Fonction | Pattern | Statut |
|--------------|---------|----------|---------|--------|
| Documentation API | `APIDocModal.js` | `handleDownloadPDF` | fetch + blob + createObjectURL | ✅ Corrigé (utilise helper) |

**Correction appliquée** : Remplacement de la logique manuelle par le helper unifié `apiDownloadPdf`.

### Backend - Génération PDF

| Endpoint | Fichier | Fonction | Headers | Statut |
|----------|---------|----------|---------|--------|
| `GET /api/docs/integrations.pdf` | `backend/api/routes/docs.py` | `get_integrations_pdf` | Content-Type + Content-Disposition | ✅ Corrigé (expose headers) |

**Correction appliquée** : Ajout de `Access-Control-Expose-Headers` pour permettre au frontend de lire `Content-Disposition`.

## Helper unifié créé

### Fichier : `frontend/src/utils/pdfDownload.js`

**Fonctions disponibles** :

1. **`apiDownloadPdf(url, filename?, options?)`**
   - Télécharge un PDF depuis un endpoint backend
   - Extrait automatiquement le filename depuis `Content-Disposition` si non fourni
   - Gère les erreurs et la validation du type de fichier
   - Utilise `axios` avec `responseType: 'blob'`

2. **`downloadBlobAsFile(blob, filename)`**
   - Télécharge un Blob comme fichier
   - Crée un object URL temporaire
   - Nettoie automatiquement après téléchargement

3. **`generatePdfFromDom(element, filename, options?)`**
   - Helper pour générer un PDF depuis un élément DOM
   - Wrapper autour de html2canvas + jsPDF
   - Gère la pagination automatique
   - Callback `onPdfReady` pour ajouter headers/footers personnalisés

## Modifications apportées

### 1. Helper unifié créé

**Fichier** : `frontend/src/utils/pdfDownload.js`

```javascript
// Fonctions exportées :
export async function apiDownloadPdf(url, filename = null, options = {})
export async function downloadBlobAsFile(blob, filename)
export async function generatePdfFromDom(element, filename, options = {})
```

### 2. APIDocModal.js - Utilisation du helper

**AVANT** :
```javascript
const response = await fetch(`${API_BASE}/api/docs/integrations.pdf`, {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
// ... logique manuelle
```

**APRÈS** :
```javascript
import { apiDownloadPdf } from '../../utils/pdfDownload';

const handleDownloadPDF = async () => {
  try {
    await apiDownloadPdf('/api/docs/integrations.pdf', 'NOTICE_API_INTEGRATIONS.pdf');
  } catch (error) {
    // Error handling
  }
};
```

### 3. Backend - CORS expose headers

**Fichier** : `backend/main.py`

```diff
--- a/backend/main.py
+++ b/backend/main.py
@@ -91,7 +91,8 @@ app.add_middleware(
     CORSMiddleware,
     allow_origins=allowed_origins,
     allow_credentials=True,
     allow_methods=["*"],
     allow_headers=["*"],
+    expose_headers=["Content-Disposition", "Content-Type", "Content-Length"],  # Expose headers for PDF downloads
 )
```

### 4. Backend - Endpoint PDF avec headers explicites

**Fichier** : `backend/api/routes/docs.py`

```diff
--- a/backend/api/routes/docs.py
+++ b/backend/api/routes/docs.py
@@ -168,7 +168,11 @@ async def get_integrations_pdf(
         # Return PDF response
         return Response(
             content=pdf_content,
             media_type="application/pdf",
             headers={
-                "Content-Disposition": "attachment; filename=NOTICE_API_INTEGRATIONS.pdf"
+                "Content-Disposition": "attachment; filename=NOTICE_API_INTEGRATIONS.pdf",
+                "Content-Type": "application/pdf",
+                "Access-Control-Expose-Headers": "Content-Disposition, Content-Type, Content-Length"
             }
         )
```

## Diff exacts

### 1. Helper créé : `frontend/src/utils/pdfDownload.js`

Voir le fichier complet ci-dessus.

### 2. APIDocModal.js

```diff
--- a/frontend/src/components/gerant/APIDocModal.js
+++ b/frontend/src/components/gerant/APIDocModal.js
@@ -1,6 +1,7 @@
 import React, { useState } from 'react';
 import { X, Book, ExternalLink, Download } from 'lucide-react';
 import { API_BASE } from '../../lib/api';
+import { apiDownloadPdf } from '../../utils/pdfDownload';
 import SupportModal from '../SupportModal';
 
@@ -11,46 +12,9 @@ export default function APIDocModal({ isOpen, onClose }) {
   const handleDownloadPDF = async () => {
     try {
-      const token = localStorage.getItem('token');
-      
-      if (!token) {
-        alert('Vous devez être connecté pour télécharger le PDF.');
-        return;
-      }
-
-      const response = await fetch(`${API_BASE}/api/docs/integrations.pdf`, {
-        method: 'GET',
-        headers: {
-          'Authorization': `Bearer ${token}`
-        }
-      });
-
-      if (!response.ok) {
-        const errorText = await response.text();
-        console.error('Erreur serveur:', response.status, errorText);
-        throw new Error(`Erreur ${response.status}: ${errorText || 'Erreur lors du téléchargement du PDF'}`);
-      }
-
-      const blob = await response.blob();
-      
-      // Vérifier que c'est bien un PDF
-      if (blob.type && blob.type !== 'application/pdf' && !blob.type.includes('pdf')) {
-        console.error('Type de fichier reçu:', blob.type);
-        // Ne pas bloquer si le type n'est pas défini (certains serveurs ne le renvoient pas)
-        if (blob.type) {
-          throw new Error('Le fichier reçu n\'est pas un PDF');
-        }
-      }
-
-      const url = window.URL.createObjectURL(blob);
-      const a = document.createElement('a');
-      a.href = url;
-      a.download = 'NOTICE_API_INTEGRATIONS.pdf';
-      document.body.appendChild(a);
-      a.click();
-      window.URL.revokeObjectURL(url);
-      document.body.removeChild(a);
+      // Use unified PDF download helper
+      await apiDownloadPdf('/api/docs/integrations.pdf', 'NOTICE_API_INTEGRATIONS.pdf');
     } catch (error) {
       console.error('Erreur lors du téléchargement du PDF:', error);
       alert(`Erreur lors du téléchargement du PDF: ${error.message || 'Veuillez réessayer.'}`);
```

### 3. Backend main.py

```diff
--- a/backend/main.py
+++ b/backend/main.py
@@ -91,7 +91,8 @@ app.add_middleware(
     CORSMiddleware,
     allow_origins=allowed_origins,
     allow_credentials=True,
     allow_methods=["*"],
     allow_headers=["*"],
+    expose_headers=["Content-Disposition", "Content-Type", "Content-Length"],
 )
```

### 4. Backend docs.py

```diff
--- a/backend/api/routes/docs.py
+++ b/backend/api/routes/docs.py
@@ -168,7 +168,11 @@ async def get_integrations_pdf(
         return Response(
             content=pdf_content,
             media_type="application/pdf",
             headers={
-                "Content-Disposition": "attachment; filename=NOTICE_API_INTEGRATIONS.pdf"
+                "Content-Disposition": "attachment; filename=NOTICE_API_INTEGRATIONS.pdf",
+                "Content-Type": "application/pdf",
+                "Access-Control-Expose-Headers": "Content-Disposition, Content-Type, Content-Length"
             }
         )
```

## Tableau récapitulatif final

| Endroit (UI) | Fichier | Endpoint | Statut | Action |
|--------------|---------|----------|--------|--------|
| Brief Matinal | `MorningBriefModal.js` | N/A (client-side) | ✅ OK | Aucune |
| Entretien Annuel | `EvaluationGenerator.js` | N/A (client-side) | ✅ OK | Aucune |
| Bilan Performance | `PerformanceModal.js` | N/A (client-side) | ✅ OK | Aucune |
| Bilan Individuel | `BilanIndividuelModal.js` | N/A (client-side) | ✅ OK | Aucune |
| Documentation API | `APIDocModal.js` | `GET /api/docs/integrations.pdf` | ✅ Corrigé | Utilise helper |
| Backend CORS | `main.py` | N/A | ✅ Corrigé | Expose headers |
| Backend PDF | `docs.py` | `GET /api/docs/integrations.pdf` | ✅ Corrigé | Headers explicites |

## Tests

### Test 1 : Téléchargement PDF depuis backend
```bash
# Test avec curl
curl -X GET "https://api.retailperformerai.com/api/docs/integrations.pdf" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/pdf" \
  -o test.pdf

# Vérifier headers
curl -I -X GET "https://api.retailperformerai.com/api/docs/integrations.pdf" \
  -H "Authorization: Bearer {token}"
```

**Résultat attendu** :
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename=NOTICE_API_INTEGRATIONS.pdf`
- `Access-Control-Expose-Headers: Content-Disposition, Content-Type, Content-Length`

### Test 2 : Frontend - Téléchargement PDF
1. Ouvrir "Documentation API" (gérant)
2. Cliquer sur "Télécharger PDF"
3. Vérifier que le PDF se télécharge avec le bon nom de fichier
4. Vérifier que le PDF est lisible (pas de corruption)

### Test 3 : Génération PDF côté client
1. Générer un brief matinal → Télécharger PDF
2. Générer un entretien annuel → Télécharger PDF
3. Ouvrir un bilan performance → Télécharger PDF
4. Ouvrir un bilan individuel → Télécharger PDF

**Résultat attendu** : Tous les PDF sont lisibles, pas de corruption de caractères.

## Notes importantes

1. **Génération PDF côté client** : Tous les composants utilisent déjà le pattern correct (html2canvas + jsPDF avec DOM snapshot). Aucune modification nécessaire.

2. **Téléchargement PDF depuis backend** : Le helper unifié `apiDownloadPdf` standardise le comportement et facilite la maintenance.

3. **CORS expose headers** : Nécessaire pour que le frontend puisse lire `Content-Disposition` et extraire le filename automatiquement.

4. **Backend headers** : Tous les endpoints PDF doivent retourner :
   - `Content-Type: application/pdf`
   - `Content-Disposition: attachment; filename=...`
   - `Access-Control-Expose-Headers: Content-Disposition, Content-Type, Content-Length`

## Résultat final

✅ **Tous les PDF utilisent le pattern correct** :
- Génération côté client : DOM snapshot (html2canvas + jsPDF)
- Téléchargement depuis backend : Helper unifié avec extraction automatique du filename
- Backend : Headers standardisés avec CORS expose headers

✅ **Aucune corruption de caractères attendue** : Tous les PDF sont générés depuis le DOM rendu, pas depuis des strings brutes.

✅ **Maintenance facilitée** : Helper unifié pour tous les téléchargements PDF depuis le backend.

