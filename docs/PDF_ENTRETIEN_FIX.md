# Fix PDF Entretien Annuel - Corruption de caractères

## Problème identifié

Le PDF généré dans "Mon équipe > Préparer l'entretien > bouton PDF" affichait des caractères corrompus (ex: "&-0E& ...", des "&" entre chaque lettre), alors que l'affichage dans le modal était correct.

**Symptôme** : Même problème que le PDF du brief matinal avant correction.

## Analyse

### Code AVANT correction

**EvaluationGenerator.js** (ligne 127-309) :
- Utilisait `jsPDF.text()` directement avec des strings brutes
- Convertissait `guideData` (JSON) en texte via `pdf.text()` et `pdf.splitTextToSize()`
- Problème : Les caractères spéciaux (accents, entités HTML) étaient mal encodés

```javascript
// ❌ ANCIENNE MÉTHODE (problématique)
const pdf = new jsPDF('p', 'mm', 'a4');
pdf.text(titleText, margin, 28);  // Corruption si titleText contient "&apos;"
const lines = pdf.splitTextToSize(items, pageWidth - 2 * margin - 10);
lines.forEach(line => {
  pdf.text(line, margin + 5, yPosition);  // Corruption des accents
});
```

### Solution appliquée (identique au brief matinal)

**Stratégie** : Exporter le DOM rendu (déjà propre) au lieu de convertir la string brute.

1. **DOM snapshot** : Capturer le contenu HTML déjà rendu dans le modal
2. **html2canvas** : Convertir le DOM en image
3. **jsPDF** : Ajouter l'image au PDF

## Modifications apportées

### Fichier modifié : `frontend/src/components/EvaluationGenerator.js`

#### 1. Ajout des imports

```diff
--- a/frontend/src/components/EvaluationGenerator.js
+++ b/frontend/src/components/EvaluationGenerator.js
@@ -1,6 +1,7 @@
-import React, { useState } from 'react';
+import React, { useState, useRef } from 'react';
 import axios from 'axios';
 import { X, Sparkles, Copy, Check, FileText, Calendar, Loader2, CheckCircle, AlertTriangle, Target, MessageSquare, Star, Download } from 'lucide-react';
 import { toast } from 'sonner';
 import jsPDF from 'jspdf';
+import html2canvas from 'html2canvas';
 import { API_BASE } from '../lib/api';
```

#### 2. Ajout du ref pour le contenu

```diff
@@ -30,6 +31,9 @@ export default function EvaluationGenerator({ isOpen, onClose, employeeId, empl
   const [error, setError] = useState('');
   const [exportingPDF, setExportingPDF] = useState(false);
 
+  // Ref pour le container du guide (source unique pour le PDF - DOM snapshot)
+  const guideContentRef = useRef(null);
+
   if (!isOpen) return null;
```

#### 3. Remplacement de `exportToPDF` (méthode complète)

**AVANT** : ~180 lignes de code avec `jsPDF.text()` et `pdf.splitTextToSize()`

**APRÈS** : Méthode basée sur DOM snapshot (identique au brief matinal)

```javascript
const exportToPDF = async () => {
  if (!guideData) return;
  
  setExportingPDF(true);
  
  try {
    // ============================================================
    // ÉTAPE 1: DIAGNOSTIC - Logs des sources de contenu
    // ============================================================
    console.log('=== PDF GENERATION DIAGNOSTIC (ENTRETIEN) ===');
    console.log('PDF_SOURCE_rawState:', JSON.stringify(guideData, null, 2));
    console.log('PDF_SOURCE_domText:', guideContentRef.current?.innerText?.substring(0, 300) || 'REF_NOT_READY');
    console.log('PDF_SOURCE_domHTML:', guideContentRef.current?.innerHTML?.substring(0, 500) || 'REF_NOT_READY');
    
    // Vérifier si le ref est disponible
    if (!guideContentRef.current) {
      console.warn('⚠️ guideContentRef not ready, cannot generate PDF');
      toast.error('Le contenu n\'est pas encore chargé. Veuillez réessayer.');
      return;
    }
    
    // ============================================================
    // ÉTAPE 2: CAPTURE DOM avec html2canvas (source unique)
    // ============================================================
    const guideElement = guideContentRef.current;
    
    // Cloner l'élément pour éviter de modifier le DOM visible
    const clonedElement = guideElement.cloneNode(true);
    clonedElement.style.position = 'absolute';
    clonedElement.style.left = '-9999px';
    clonedElement.style.top = '0';
    clonedElement.style.width = guideElement.offsetWidth + 'px';
    clonedElement.style.backgroundColor = '#ffffff';
    document.body.appendChild(clonedElement);
    
    try {
      // Attendre un peu pour que le clone soit rendu
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capturer le DOM en canvas
      const canvas = await html2canvas(clonedElement, {
        scale: 2, // Haute résolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: guideElement.offsetWidth,
        windowHeight: guideElement.offsetHeight
      });
      
      // Nettoyer le clone
      document.body.removeChild(clonedElement);
      
      // ============================================================
      // ÉTAPE 3: CRÉER PDF depuis le canvas
      // ============================================================
      const imgData = canvas.toDataURL('image/png', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      
      // Ajouter un header professionnel
      const headerColor = role === 'seller' ? [249, 115, 22] : [30, 64, 175];
      pdf.setFillColor(...headerColor);
      pdf.rect(0, 0, pageWidth, 30, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Retail Performer AI', margin, 12);
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      const titleText = role === 'seller' ? 'Fiche de Préparation - Entretien Annuel' : "Guide d'Entretien Annuel";
      pdf.text(titleText, margin, 20);
      
      pdf.setFontSize(10);
      const periodText = `Période : ${new Date(startDate).toLocaleDateString('fr-FR')} - ${new Date(endDate).toLocaleDateString('fr-FR')}`;
      pdf.text(periodText, pageWidth - margin - pdf.getTextWidth(periodText), 20);
      
      // Calculer les dimensions de l'image pour qu'elle rentre dans la page
      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Ajouter l'image au PDF (gérer la pagination si nécessaire)
      let heightLeft = imgHeight;
      let position = 35; // Après le header
      
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - position - margin);
      
      // Ajouter des pages supplémentaires si nécessaire
      while (heightLeft > 0) {
        position = -heightLeft + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 2 * margin);
      }
      
      // Ajouter un footer sur chaque page
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, pageHeight - 12, pageWidth, 12, 'F');
        
        pdf.setTextColor(148, 163, 184);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Généré par Retail Performer AI • ' + new Date().toLocaleDateString('fr-FR'), margin, pageHeight - 5);
        pdf.text('Page ' + i + '/' + pageCount, pageWidth - margin - 20, pageHeight - 5);
      }
      
      // ============================================================
      // ÉTAPE 4: SAUVEGARDER
      // ============================================================
      const roleLabel = role === 'seller' ? 'preparation' : 'evaluation';
      const fileName = `${roleLabel}_${(employeeName || 'collaborateur').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      console.log('✅ PDF généré depuis DOM snapshot (pas de corruption attendue)');
      toast.success('PDF téléchargé avec succès !');
      
    } catch (canvasError) {
      // Nettoyer le clone en cas d'erreur
      if (document.body.contains(clonedElement)) {
        document.body.removeChild(clonedElement);
      }
      throw canvasError;
    }
    
  } catch (error) {
    console.error('Erreur export PDF (DOM-based):', error);
    toast.error('Erreur lors de la génération du PDF');
  } finally {
    setExportingPDF(false);
  }
};
```

#### 4. Attacher le ref au contenu rendu

```diff
--- a/frontend/src/components/EvaluationGenerator.js
+++ b/frontend/src/components/EvaluationGenerator.js
@@ -474,7 +474,7 @@ export default function EvaluationGenerator({ isOpen, onClose, employeeId, empl
 
           {/* Generated Content - CARTES COLORÉES */}
           {guideData && (
-            <div className="space-y-4">
+            <div ref={guideContentRef} className="space-y-4">
               {/* Header avec bouton copier */}
```

## Avantages de cette approche

1. **Fidélité visuelle** : Le PDF est identique à l'affichage modal (même rendu, mêmes couleurs, même formatage)
2. **Pas de corruption** : Le texte est déjà rendu correctement dans le DOM, donc pas de problème d'encodage
3. **Simplicité** : Pas besoin de gérer manuellement les entités HTML, les accents, les sauts de ligne
4. **Cohérence** : Même stratégie que le brief matinal (maintenance facilitée)

## Logs de debug ajoutés

Les logs suivants apparaîtront dans la console lors de la génération du PDF :

```
=== PDF GENERATION DIAGNOSTIC (ENTRETIEN) ===
PDF_SOURCE_rawState: {...}  // État brut du guideData (JSON)
PDF_SOURCE_domText: "..."   // Texte extrait du DOM (300 premiers caractères)
PDF_SOURCE_domHTML: "..."   // HTML du DOM (500 premiers caractères)
✅ PDF généré depuis DOM snapshot (pas de corruption attendue)
```

Ces logs permettent de :
- Vérifier que le ref est bien attaché
- Comparer le contenu brut vs le contenu rendu
- Diagnostiquer les problèmes restants si nécessaire

## Checklist de test en production

### Test 1 : Génération PDF Manager
- [ ] Ouvrir "Mon Équipe" > Sélectionner un vendeur > "Préparer l'entretien"
- [ ] Générer un guide d'entretien
- [ ] Cliquer sur "PDF"
- [ ] Vérifier que le PDF s'ouvre sans erreur
- [ ] Vérifier que le texte est lisible (pas de "&" parasites, accents corrects)
- [ ] Vérifier que les couleurs des cartes sont présentes
- [ ] Vérifier que le header et footer sont corrects

### Test 2 : Génération PDF Seller
- [ ] Ouvrir "Préparer Mon Entretien Annuel" (côté vendeur)
- [ ] Générer une fiche de préparation
- [ ] Cliquer sur "PDF"
- [ ] Vérifier que le PDF s'ouvre sans erreur
- [ ] Vérifier que le texte est lisible
- [ ] Vérifier que le header orange est présent

### Test 3 : Contenu avec caractères spéciaux
- [ ] Générer un guide avec des accents (é, è, à, ç, etc.)
- [ ] Générer un guide avec des apostrophes et guillemets
- [ ] Vérifier que le PDF affiche correctement tous les caractères

### Test 4 : Contenu long (pagination)
- [ ] Générer un guide avec beaucoup de contenu (plusieurs sections remplies)
- [ ] Vérifier que le PDF s'étend sur plusieurs pages
- [ ] Vérifier que le footer "Page X/Y" est présent sur chaque page
- [ ] Vérifier que le contenu n'est pas coupé entre les pages

### Test 5 : Console logs
- [ ] Ouvrir la console du navigateur (F12)
- [ ] Générer un PDF
- [ ] Vérifier que les logs `=== PDF GENERATION DIAGNOSTIC (ENTRETIEN) ===` apparaissent
- [ ] Vérifier que `PDF_SOURCE_domText` contient du texte lisible (pas de "&" parasites)
- [ ] Vérifier que `✅ PDF généré depuis DOM snapshot` apparaît

## Comparaison avec le brief matinal

| Aspect | Brief Matinal | Entretien Annuel |
|--------|---------------|------------------|
| **Méthode** | DOM snapshot (html2canvas) | DOM snapshot (html2canvas) |
| **Ref** | `briefContentRef` | `guideContentRef` |
| **Source** | DOM rendu du brief | DOM rendu du guide |
| **Header PDF** | Gradient orange/jaune | Orange (seller) ou Bleu (manager) |
| **Footer PDF** | Oui | Oui |
| **Pagination** | Automatique | Automatique |
| **Logs debug** | Oui | Oui |

## Notes importantes

- **Ne pas modifier le texte affiché dans l'UI** : Le nettoyage s'applique uniquement à la version export PDF
- **Le rendu modal est correct** : La bonne source pour le PDF est le DOM du modal, pas la string brute
- **Pas de double-escape** : Le DOM contient déjà le texte correctement rendu, donc pas besoin de décoder/encoder

## Résultat attendu

Après correction :
- ✅ PDF lisible sans caractères "&" parasites
- ✅ Accents et caractères spéciaux correctement affichés
- ✅ Fidélité visuelle avec le modal (mêmes couleurs, même formatage)
- ✅ Pagination automatique pour les contenus longs
- ✅ Header et footer professionnels

