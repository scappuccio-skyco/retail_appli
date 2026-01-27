# 📚 INDEX DES DOCUMENTS - RETAIL PERFORMER AI

**Dernière mise à jour**: 27 Janvier 2026  
**Objectif**: Navigation rapide dans la documentation du projet

---

## ⭐ DOCUMENTS ESSENTIELS (À Consulter en Premier)

### Source de Vérité
- **`.cursorrules`** ⭐⭐⭐ - **SOURCE DE VÉRITÉ** - Règles de développement, architecture, patterns
- **`README.md`** - Documentation principale du projet
- **`CHANGELOG.md`** - Historique des versions et changements

### Architecture & Design
- **`AUDIT_ARCHITECTURAL_CRITIQUE.md`** ⭐⭐ - Audit complet (27 Jan 2026) - Anti-patterns, redondances, scalabilité
- **`SYNTHESE_ARCHITECTURE_POST_REFACTORING.md`** - Architecture actuelle (Clean Architecture)
- **`REFACTORING_SUMMARY.md`** - Résumé du refactoring (avant/après)
- **`ARCHITECTURE_DIAGRAM.md`** - Diagrammes d'architecture

---

## 📖 DOCUMENTATION API

### Guides API
- `API_README.md` - Documentation API principale
- `API_INTEGRATION_GUIDE.md` - Guide d'intégration API
- `API_EXAMPLES.md` - Exemples d'utilisation API
- `GUIDE_API_MANAGER.md` - Guide endpoints Manager
- `GUIDE_API_SELLER.md` - Guide endpoints Vendeur
- `GUIDE_API_STORES.md` - Guide endpoints Stores

### Documentation Technique
- `ENTERPRISE_API_DOCUMENTATION.md` - API entreprise
- `ENDPOINTS_STRIPE.md` - Endpoints Stripe
- `EXEMPLES_CURL_INTEGRATIONS_CRUD.md` - Exemples cURL

---

## 🔧 CONFIGURATION & DÉPLOIEMENT

- `DEPLOYMENT_GUIDE.md` - Guide de déploiement
- `TROUBLESHOOTING_API_KEYS.md` - Dépannage clés API
- `PATCH_VERCEL_UV_RESOLUTION.md` - Correctifs Vercel
- `AUDIT_VERCEL_UV_RESOLUTION.md` - Audit Vercel

---

## 📊 AUDITS & ANALYSES

### Audits Actifs (Référence)
- `AUDIT_ARCHITECTURAL_CRITIQUE.md` ⭐ - Audit architectural complet (27 Jan 2026)

### Audits à Archiver (Terminés)
- `AUDIT_FINAL_PROJET.md` → `docs/archive/2025-01/`
- `AUDIT_PRODUCTION_READY_HIGH_SCALE.md` → `docs/archive/2025-01/`
- `AUDIT_TECHNIQUE_PRODUCTION.md` → `docs/archive/2025-01/`
- `AUDIT_ROUTES_*.md` (3 fichiers) → `docs/archive/2025-01/`
- `AUDIT_VERCEL_*.md` (3 fichiers) → `docs/archive/2025-01/`

---

## 🚀 OPTIMISATIONS (Terminées - À Archiver)

### Vagues d'Optimisation
- `VAGUE_1_CORRECTIONS_MEMOIRE.md` → `docs/archive/2025-01/`
- `VAGUE_2_CORRECTIONS_N+1.md` → `docs/archive/2025-01/`
- `VAGUE_3_CORRECTIONS_INDEXES.md` → `docs/archive/2025-01/`
- `VAGUE_3_TEST_INDEXES.md` → `docs/archive/2025-01/`
- `VAGUE_4_CORRECTIONS_SECURITY.md` → `docs/archive/2025-01/`
- `RESUME_4_VAGUES_OPTIMISATION.md` → `docs/archive/2025-01/`

### Découplage (Terminé)
- `BILAN_COMPLET_DECOUPLAGE.md` → `docs/archive/2025-01/`
- `DECOUPLAGE_3_ETAPES_COMPLETE.md` → `docs/archive/2025-01/`
- `PLAN_REFACTORING_DECOUPLAGE.md` → `docs/archive/2025-01/`
- `ANALYSE_DECOUPLAGE_SERVICES.md` → `docs/archive/2025-01/`

---

## 🐛 CORRECTIONS (Dans docs/)

### Corrections Actives
- `docs/CORRECTION_*.md` (8 fichiers) - Corrections récentes de bugs

### Corrections à Archiver
- `CORRECTIF_BLOCAGE_TRIAL_EXPIRED.md` → `docs/archive/2025-01/`
- `RESOLUTION_CADENAS_BLOCAGE.md` → `docs/archive/2025-01/`

---

## 📝 RÉSUMÉS & BILANS (À Archiver)

- `RESUME_IMPLEMENTATION_COMPLETE.md` → `docs/archive/2025-01/`
- `RESUME_IMPLEMENTATION_NOTICE_PDF.md` → `docs/archive/2025-01/`
- `RESUME_FINAL_VERROUILLAGE.md` → `docs/archive/2025-01/`

---

## 🗂️ ORGANISATION

### Structure Recommandée

```
.
├── .cursorrules                    # ⭐ SOURCE DE VÉRITÉ
├── README.md                       # Documentation principale
├── CHANGELOG.md                    # Historique versions
├── AUDIT_ARCHITECTURAL_CRITIQUE.md # Audit actuel
├── SYNTHESE_ARCHITECTURE_POST_REFACTORING.md
├── REFACTORING_SUMMARY.md
│
├── docs/
│   ├── archive/                   # Documents archivés
│   │   ├── 2024-12/
│   │   ├── 2025-01/              # Janvier 2025
│   │   └── 2025-02/              # Février 2025
│   │
│   ├── INDEX_DOCUMENTS.md        # Ce fichier
│   ├── ORGANISATION_DOCUMENTS.md  # Guide d'organisation
│   └── [docs actifs]             # Corrections, audits récents
│
└── [autres docs racine]          # Documentation API, guides
```

---

## 🔍 COMMENT TROUVER UN DOCUMENT

### Par Type
- **Architecture**: `AUDIT_ARCHITECTURAL_CRITIQUE.md`, `SYNTHESE_ARCHITECTURE_*.md`
- **API**: `API_*.md`, `GUIDE_API_*.md`
- **Optimisations**: `VAGUE_*.md` (archivés), `RESUME_*.md` (archivés)
- **Corrections**: `docs/CORRECTION_*.md`
- **Déploiement**: `DEPLOYMENT_*.md`, `AUDIT_VERCEL_*.md`

### Par Date
- **Décembre 2024**: `docs/archive/2024-12/`
- **Janvier 2025**: `docs/archive/2025-01/`
- **Février 2025**: `docs/archive/2025-02/`

---

## 📋 PROCESSUS D'ARCHIVAGE

### Script d'Archivage

```powershell
# Exécuter le script d'organisation
.\scripts\organize_docs.ps1
```

### Archivage Manuel

1. Vérifier que le document est terminé et documenté dans CHANGELOG
2. Déplacer vers `docs/archive/YYYY-MM/`
3. Mettre à jour cet index si nécessaire

---

*Index créé le 27 Janvier 2026*
