# 📚 INDEX DES DOCUMENTS - RETAIL PERFORMER AI

**Dernière mise à jour**: 30 Janvier 2026  
**Objectif**: Navigation rapide dans la documentation du projet

---

## ⭐ DOCUMENTS ESSENTIELS (À Consulter en Premier)

### Source de Vérité
- **`.cursorrules`** ⭐⭐⭐ - **SOURCE DE VÉRITÉ** - Règles de développement, architecture, patterns
- **`README.md`** - Documentation principale du projet (racine)
- **`docs/archive/2026-01/CHANGELOG.md`** - Historique des versions et changements

### Architecture & Design
- **`docs/RAPPORT_AUDIT_REFACTORISATION.md`** ⭐ - Rapport d'audit refactorisation (découpage manager, services, pagination, Phase 3–4)
- **`docs/archive/2026-01/AUDIT_ARCHITECTURAL_CRITIQUE.md`** ⭐⭐ - Audit complet (27 Jan 2026) - Anti-patterns, redondances, scalabilité
- **`docs/archive/2026-01/SYNTHESE_ARCHITECTURE_POST_REFACTORING.md`** - Architecture actuelle (Clean Architecture)
- **`docs/archive/2026-01/REFACTORING_SUMMARY.md`** - Résumé du refactoring (avant/après)
- **`docs/archive/2026-01/ARCHITECTURE_DIAGRAM.md`** - Diagrammes d'architecture

---

## 📖 DOCUMENTATION API

### Guides API
- `docs/archive/2026-01/API_README.md` - Documentation API principale
- `docs/archive/2026-01/API_INTEGRATION_GUIDE.md` - Guide d'intégration API
- `docs/archive/2026-01/API_EXAMPLES.md` - Exemples d'utilisation API
- `docs/archive/2026-01/GUIDE_API_MANAGER.md` - Guide endpoints Manager
- `docs/archive/2026-01/GUIDE_API_SELLER.md` - Guide endpoints Vendeur
- `docs/archive/2026-01/GUIDE_API_STORES.md` - Guide endpoints Stores

### Documentation Technique
- `docs/archive/2026-01/ENTERPRISE_API_DOCUMENTATION.md` - API entreprise
- `docs/archive/2026-01/ENDPOINTS_STRIPE.md` - Endpoints Stripe
- `docs/archive/2026-01/EXEMPLES_CURL_INTEGRATIONS_CRUD.md` - Exemples cURL

---

## 🔧 CONFIGURATION & DÉPLOIEMENT

- `docs/archive/2026-01/DEPLOYMENT_GUIDE.md` - Guide de déploiement
- `docs/archive/2026-01/TROUBLESHOOTING_API_KEYS.md` - Dépannage clés API
- `docs/archive/2026-01/PATCH_VERCEL_UV_RESOLUTION.md` - Correctifs Vercel
- `docs/archive/2026-01/AUDIT_VERCEL_UV_RESOLUTION.md` - Audit Vercel

---

## 📊 AUDITS & ANALYSES

### Audits Actifs (Référence)
- `docs/RAPPORT_AUDIT_REFACTORISATION.md` - Rapport refactorisation manager (package routes store/sellers/analytics/objectives/challenges/consultations, dependencies, pagination Phase 4, main_legacy supprimé)
- `docs/archive/2026-01/AUDIT_ARCHITECTURAL_CRITIQUE.md` ⭐ - Audit architectural complet (27 Jan 2026)

### Audits (déjà dans docs/archive/2026-01/)
- Les audits et rapports sont dans `docs/archive/2026-01/` (tri par mois).

---

## 🚀 OPTIMISATIONS (Terminées - À Archiver)

### Vagues d'Optimisation & Découplage
- Tous dans `docs/archive/2026-01/` (VAGUE_*.md, RESUME_4_VAGUES_OPTIMISATION.md, BILAN_COMPLET_DECOUPLAGE.md, etc.)

---

## 🐛 CORRECTIONS (Dans docs/)

### Corrections Actives
- `docs/CORRECTION_*.md` (8 fichiers) - Corrections récentes de bugs

### Corrections à Archiver
- Déjà dans `docs/archive/2026-01/` (CORRECTIF_*, RESOLUTION_*, etc.)

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
├── .cursorrules                    # ⭐ SOURCE DE VÉRITÉ (à jour 30 Jan 2026)
├── README.md                       # Documentation principale (seul .md à la racine)
│
├── docs/
│   ├── archive/                   # Documents archivés par mois (YYYY-MM)
│   │   └── 2026-01/              # Janvier 2026 (audits, phases, CHANGELOG, guides…)
│   │
│   ├── INDEX_DOCUMENTS.md        # Ce fichier
│   ├── ORGANISATION_DOCUMENTS.md  # Guide d'organisation
│   ├── RAPPORT_AUDIT_REFACTORISATION.md  # Refactorisation Phase 3–4 (manager, pagination)
│   └── [docs actifs]             # CORRECTION_*, AUDIT_*, MIGRATION_*, etc.
```

---

## 🔍 COMMENT TROUVER UN DOCUMENT

### Par Type
- **Architecture**: `docs/archive/2026-01/AUDIT_ARCHITECTURAL_CRITIQUE.md`, `docs/archive/2026-01/SYNTHESE_ARCHITECTURE_*.md`
- **API**: `docs/archive/2026-01/API_*.md`, `docs/archive/2026-01/GUIDE_API_*.md`
- **Optimisations**: `docs/archive/2026-01/VAGUE_*.md`, `docs/archive/2026-01/RESUME_*.md`
- **Corrections**: `docs/CORRECTION_*.md`
- **Déploiement**: `docs/archive/2026-01/DEPLOYMENT_*.md`, `docs/archive/2026-01/AUDIT_VERCEL_*.md`

### Par Date
- **Janvier 2026**: `docs/archive/2026-01/` (tous les docs déplacés de la racine, triés par mois)

---

## 📋 PROCESSUS D'ARCHIVAGE

### Script d'Archivage

```powershell
# Exécuter le script d'organisation
.\scripts\organize_docs.ps1
```

### Archivage Manuel

1. Vérifier que le document est terminé et documenté dans `docs/archive/2026-01/CHANGELOG.md`
2. Déplacer tout nouveau .md de la racine vers `docs/archive/YYYY-MM/` (mois de dernière modification)
3. Mettre à jour cet index si nécessaire

---

*Index créé le 27 Janvier 2026 – Dernière mise à jour 30 Janvier 2026*
