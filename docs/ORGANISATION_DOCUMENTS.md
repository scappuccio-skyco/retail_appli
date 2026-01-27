# 📁 ORGANISATION DES DOCUMENTS - GUIDE

**Date de création**: 27 Janvier 2026  
**Objectif**: Organiser méthodiquement tous les documents .md du projet

---

## 📂 STRUCTURE D'ORGANISATION

```
docs/
├── archive/                    # Documents archivés par date
│   ├── 2024-12/               # Décembre 2024
│   ├── 2025-01/               # Janvier 2025
│   └── 2025-02/               # Février 2025
│
├── [docs actifs]              # Documents de référence actuels (racine docs/)
│   ├── CORRECTION_*.md        # Corrections de bugs
│   ├── AUDIT_*.md             # Audits techniques
│   └── ...
│
└── [racine projet]            # Documents de référence principaux
    ├── .cursorrules           # ⭐ SOURCE DE VÉRITÉ (à jour)
    ├── README.md              # Documentation principale
    ├── CHANGELOG.md           # Historique des versions
    ├── AUDIT_ARCHITECTURAL_CRITIQUE.md  # Audit complet
    └── SYNTHESE_ARCHITECTURE_POST_REFACTORING.md  # Architecture actuelle
```

---

## 📋 CATÉGORIES DE DOCUMENTS

### 1. Documents de Référence (Racine - À GARDER)

**Ne jamais archiver** - Toujours à jour:

- `.cursorrules` - ⭐ **SOURCE DE VÉRITÉ** - Règles de développement
- `README.md` - Documentation principale du projet
- `CHANGELOG.md` - Historique des versions
- `AUDIT_ARCHITECTURAL_CRITIQUE.md` - Audit architectural complet
- `SYNTHESE_ARCHITECTURE_POST_REFACTORING.md` - Architecture actuelle
- `REFACTORING_SUMMARY.md` - Résumé du refactoring
- `ARCHITECTURE_DIAGRAM.md` - Diagrammes d'architecture

### 2. Documents Techniques Actifs (docs/)

**Garder dans `docs/`** si encore pertinents:

- `CORRECTION_*.md` - Corrections de bugs récentes
- `AUDIT_*.md` - Audits techniques récents
- `MIGRATION_*.md` - Migrations en cours
- `VERIFICATION_*.md` - Vérifications techniques

### 3. Documents à Archiver (Par Date)

**Déplacer dans `docs/archive/YYYY-MM/`**:

#### Par Type:
- `VAGUE_*.md` - Optimisations terminées (VAGUE_1, VAGUE_2, VAGUE_3, VAGUE_4)
- `RESUME_*.md` - Résumés de tâches terminées
- `AUDIT_*.md` - Audits anciens (garder uniquement le dernier)
- `CORRECTION_*.md` - Corrections anciennes (garder uniquement les récentes)
- `PLAN_*.md` - Plans de refactoring terminés
- `DIAGNOSTIC_*.md` - Diagnostics résolus

#### Par Date (Exemples):
- **Décembre 2024** (`2024-12/`):
  - `SYNTHESE_TECHNIQUE_ARCHITECTURE.md`
  - `REFACTORING_SUMMARY.md`
  - Documents de refactoring initial

- **Janvier 2025** (`2025-01/`):
  - `VAGUE_1_CORRECTIONS_MEMOIRE.md`
  - `VAGUE_2_CORRECTIONS_N+1.md`
  - `VAGUE_3_CORRECTIONS_INDEXES.md`
  - `VAGUE_4_CORRECTIONS_SECURITY.md`
  - `RESUME_4_VAGUES_OPTIMISATION.md`
  - `BILAN_COMPLET_DECOUPLAGE.md`
  - `DECOUPLAGE_3_ETAPES_COMPLETE.md`

---

## 🔄 PROCESSUS D'ARCHIVAGE

### Quand Archiver

1. **Tâche terminée** → Documenter dans CHANGELOG, puis archiver
2. **Audit remplacé** → Archiver l'ancien, garder le nouveau
3. **Correction appliquée** → Archiver après 1 mois si plus de référence
4. **Plan exécuté** → Archiver après exécution complète

### Comment Archiver

```bash
# Exemple: Archiver un document de Janvier 2025
mv VAGUE_1_CORRECTIONS_MEMOIRE.md docs/archive/2025-01/
```

### Nomenclature

**Format recommandé**: `YYYY-MM-DD_TYPE_DESCRIPTION.md`

Exemples:
- `2025-01-23_VAGUE_4_SECURITY.md`
- `2025-01-27_AUDIT_ARCHITECTURAL.md`

---

## 📊 INVENTAIRE DES DOCUMENTS

### Documents Actifs (À Garder)

#### Architecture & Design
- `AUDIT_ARCHITECTURAL_CRITIQUE.md` ⭐ (27 Jan 2026)
- `SYNTHESE_ARCHITECTURE_POST_REFACTORING.md`
- `ARCHITECTURE_DIAGRAM.md`
- `REFACTORING_SUMMARY.md`

#### Documentation API
- `API_README.md`
- `API_INTEGRATION_GUIDE.md`
- `API_EXAMPLES.md`
- `GUIDE_API_MANAGER.md`
- `GUIDE_API_SELLER.md`
- `GUIDE_API_STORES.md`

#### Configuration & Déploiement
- `DEPLOYMENT_GUIDE.md`
- `README.md`
- `CHANGELOG.md`

### Documents à Archiver (Par Priorité)

#### Priorité 1 (Anciens - Décembre 2024)
- `SYNTHESE_TECHNIQUE_ARCHITECTURE.md` → `2024-12/`

#### Priorité 2 (Optimisations Terminées - Janvier 2025)
- `VAGUE_1_CORRECTIONS_MEMOIRE.md` → `2025-01/`
- `VAGUE_2_CORRECTIONS_N+1.md` → `2025-01/`
- `VAGUE_3_CORRECTIONS_INDEXES.md` → `2025-01/`
- `VAGUE_4_CORRECTIONS_SECURITY.md` → `2025-01/`
- `RESUME_4_VAGUES_OPTIMISATION.md` → `2025-01/`

#### Priorité 3 (Découplage Terminé - Janvier 2025)
- `BILAN_COMPLET_DECOUPLAGE.md` → `2025-01/`
- `DECOUPLAGE_3_ETAPES_COMPLETE.md` → `2025-01/`
- `PLAN_REFACTORING_DECOUPLAGE.md` → `2025-01/`
- `ANALYSE_DECOUPLAGE_SERVICES.md` → `2025-01/`

---

## 🎯 RÈGLES DE GESTION

### 1. Un Document = Une Source de Vérité

- **Ne pas dupliquer** l'information entre documents
- **Référencer** plutôt que copier
- **Mettre à jour** `.cursorrules` si changement architectural

### 2. Cycle de Vie des Documents

```
Création → Actif (docs/ ou racine) → Archivé (docs/archive/YYYY-MM/) → Supprimé (après 1 an)
```

### 3. Critères d'Archivage

- ✅ Tâche terminée et documentée dans CHANGELOG
- ✅ Plus de référence active dans le code
- ✅ Remplacé par un document plus récent
- ✅ Date > 1 mois depuis dernière modification

### 4. Critères de Suppression

- ❌ Document obsolète > 1 an
- ❌ Informations dupliquées ailleurs
- ❌ Plus aucune valeur de référence

---

## 📝 MAINTENANCE

### Mensuelle

1. Vérifier documents > 1 mois dans `docs/`
2. Archiver ceux qui répondent aux critères
3. Mettre à jour cette liste

### Trimestrielle

1. Vérifier documents > 1 an dans `docs/archive/`
2. Supprimer ceux qui sont obsolètes
3. Nettoyer structure si nécessaire

---

*Guide créé le 27 Janvier 2026*
