# 🔍 AUDIT CIBLÉ - Résolution UV Vercel (SANS MODIFICATION)

**Date** : 2025-01-XX  
**Contexte** : Vercel build échoue avec "No solution found when resolving dependencies"  
**Runtime** : Python 3.12 (automatique) + uv (automatique)

---

## ✅ ÉTAPE 1 — AUDIT CIBLÉ

### 1.1) Lignes exactes dans `backend/requirements.txt`

| Dépendance | Ligne | Version Actuelle |
|------------|-------|------------------|
| `google-api-core` | 31 | `==2.28.0` |
| `grpcio` | 38 | `==1.76.0` |
| `grpcio-status` | 39 | `==1.71.2` |
| `protobuf` | 79 | `>=4.25.3,<5` (déjà patché) |
| `google-genai` | 35 | `==1.46.0` |
| `google-generativeai` | 36 | `==0.8.5` |
| `google-ai-generativelanguage` | 30 | `==0.6.15` |

### 1.2) Incohérences de versions identifiées

**🔴 PROBLÈME CRITIQUE : Incohérence grpcio vs grpcio-status**

- `grpcio==1.76.0` (ligne 38)
- `grpcio-status==1.71.2` (ligne 39)

**Analyse** : `grpcio-status` doit être **aligné** sur la version de `grpcio`. La version `1.71.2` est incompatible avec `grpcio 1.76.0`. `grpcio-status` doit être `==1.76.0` pour correspondre.

**🟡 PROBLÈME : Pin trop strict sur google-api-core**

- `google-api-core==2.28.0` (ligne 31)

**Analyse** : Version très récente (janvier 2025). Les packages Google (`google-generativeai`, `google-genai`) peuvent avoir des contraintes qui entrent en conflit avec cette version précise. Un plafond `>=2.24.2,<2.26.0` permettrait à uv de résoudre plus facilement.

### 1.3) Vérification requirements.txt (racine)

✅ **Confirmé** : `requirements.txt` (racine) contient bien :
```txt
-r backend/requirements.txt
```

### 1.4) Vérification runtime.txt

❌ **Absent** : `runtime.txt` n'existe pas à la racine.

**Impact** : Vercel utilise Python 3.12 par défaut (d'après les logs : "Using latest installed version: 3.12"). Cependant, certaines dépendances très récentes peuvent avoir des conflits de résolution avec Python 3.12. Python 3.11 est plus stable et mieux testé avec les versions récentes de gRPC/protobuf.

---

## 📊 RAPPORT FINAL - Cause la plus probable

### 🔴 **Cause la plus probable du "No solution found" uv = INCOHÉRENCE grpcio/grpcio-status**

**Explication détaillée** :

1. **Conflit de versions gRPC** :
   - `grpcio==1.76.0` nécessite `grpcio-status==1.76.0` (versions doivent être alignées)
   - Actuellement : `grpcio-status==1.71.2` (incompatible)
   - UV ne peut pas résoudre car `grpcio 1.76.0` et `grpcio-status 1.71.2` sont incompatibles

2. **Contraintes en cascade** :
   - `google-generativeai==0.8.5` dépend de `google-api-core`
   - `google-api-core==2.28.0` dépend de `grpcio`
   - `grpcio==1.76.0` nécessite `grpcio-status==1.76.0`
   - Mais `grpcio-status==1.71.2` est spécifié explicitement → **CONFLIT**

3. **Pin trop strict sur google-api-core** :
   - `google-api-core==2.28.0` est très récent (janvier 2025)
   - Peut entrer en conflit avec d'autres packages Google
   - Un plafond permettrait à uv de trouver une version compatible

**Conclusion** : Le problème principal est l'incohérence entre `grpcio==1.76.0` et `grpcio-status==1.71.2`. UV ne peut pas résoudre car ces deux packages doivent avoir la même version majeure/mineure.

---

## 📝 RÉSUMÉ AUDIT

| Problème | Sévérité | Solution |
|----------|----------|----------|
| `grpcio-status` incohérent avec `grpcio` | 🔴 **CRITIQUE** | Aligner `grpcio-status==1.76.0` |
| `google-api-core` pin trop strict | 🟡 **MOYEN** | Relâcher vers `>=2.24.2,<2.26.0` |
| `runtime.txt` absent | 🟡 **MOYEN** | Créer avec `python-3.11` |
| `protobuf` déjà patché | ✅ **OK** | `>=4.25.3,<5` (déjà appliqué) |

**Action recommandée** : Appliquer le patch minimal (alignement grpcio-status + relâchement google-api-core + runtime.txt).

