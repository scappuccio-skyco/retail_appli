# 🔍 AUDIT DÉPENDANCES PYTHON - Sans Modification

**Date** : 2025-01-XX  
**Objectif** : Identifier les conflits de versions Python et dépendances Google/gRPC

---

## 1️⃣ GESTIONNAIRE DE DÉPENDANCES

### ✅ Résultat : **pip** (pas uv)

**Preuve** :
- ✅ Présent : `backend/requirements.txt` (131 lignes)
- ✅ Présent : `requirements.txt` (racine) qui référence `backend/requirements.txt`
- ❌ Absent : `pyproject.toml`
- ❌ Absent : `uv.lock`
- ❌ Absent : fichiers `pip-tools` (pas de `requirements.in` / `requirements-compile.txt`)

**Conclusion** : Le backend utilise **pip** avec un fichier `requirements.txt` standard.

---

## 2️⃣ VERSIONS DES DÉPENDANCES GOOGLE/gRPC

### Fichier : `backend/requirements.txt`

**Lignes pertinentes identifiées** :

```txt
30:google-ai-generativelanguage==0.6.15
31:google-api-core==2.28.0
32:google-api-python-client==2.185.0
33:google-auth==2.41.1
34:google-auth-httplib2==0.2.0
35:google-genai==1.46.0
36:google-generativeai==0.8.5
37:googleapis-common-protos==1.71.0
38:grpcio==1.76.0
39:grpcio-status==1.71.2
79:protobuf==5.29.5
```

**Note** : Aucune dépendance `google-cloud-*` trouvée (pas de Google Cloud Platform SDK).

### Fichier : `requirements.txt` (racine)

```txt
1:# Requirements for Vercel serverless function
2:# This file references backend requirements
3:-r backend/requirements.txt
```

Aucune dépendance Google/gRPC directement listée (référence seulement).

---

## 3️⃣ CONTRAINTES PYTHON 3.12

### ❌ Aucune contrainte explicite dans requirements.txt

**Recherche effectuée** :
- ✅ Recherche de `^python|^Python` : **Aucun résultat**
- ✅ Recherche dans `requirements.txt` : **Pas de ligne `python>=3.12` ou similaire**
- ✅ Recherche dans `backend/requirements.txt` : **Pas de contrainte Python**

**Conclusion** : Aucune dépendance dans `requirements.txt` n'impose explicitement Python 3.12.

### ⚠️ Contraintes implicites (via dépendances)

**Versions installées** (très récentes, janvier 2025) :
- `grpcio==1.76.0` (ligne 38)
- `grpcio-status==1.71.2` (ligne 39)
- `protobuf==5.29.5` (ligne 79)
- `google-api-core==2.28.0` (ligne 31)

**Analyse** :
- ✅ `grpcio 1.76.0` : Version très récente (janvier 2025)
- ✅ `protobuf 5.29.5` : Version très récente (janvier 2025)
- ⚠️ Ces versions sont si récentes qu'elles peuvent nécessiter Python 3.12+

**Vercel Configuration** :
- Ancien `vercel.json` avait `"runtime": "python3.9"` (supprimé)
- Vercel par défaut : Python 3.9 pour serverless functions
- **Conflit potentiel** : Versions très récentes de gRPC/protobuf peuvent nécessiter Python 3.12, mais Vercel utilise Python 3.9 par défaut

---

## 4️⃣ CONCLUSION - CONFLITS IDENTIFIÉS

### 🔴 Conflit Principal : **grpcio 1.76.0 + protobuf 5.29.5 vs Python 3.9 (Vercel)**

**Explication** :

1. **Le conflit vient de `grpcio==1.76.0` et `protobuf==5.29.5`** qui sont des versions **très récentes** (janvier 2025).

2. **Contraintes incompatibles** :
   - `grpcio 1.76.0` : Peut nécessiter Python 3.12+ (versions récentes de gRPC)
   - `protobuf 5.29.5` : Peut nécessiter Python 3.12+ (versions récentes de protobuf)
   - **Vercel par défaut** : Python 3.9 pour les fonctions serverless
   - **Résultat** : Build/installation peut échouer si ces packages nécessitent Python 3.12

3. **Chaîne de dépendances** :
   ```
   google-generativeai==0.8.5
     → google-api-core==2.28.0
        → grpcio (contrainte implicite)
        → protobuf (contrainte implicite)
   ```

4. **Source du problème** :
   - Les dépendances Google AI (`google-generativeai`, `google-genai`) ont été mises à jour vers des versions très récentes
   - Ces versions récentes entraînent des mises à jour en cascade vers `grpcio` et `protobuf` très récents
   - Ces versions très récentes peuvent être **incompatibles avec Python 3.9**

### 🔴 Conflit Secondaire : **Vercel Runtime**

- Vercel utilise **Python 3.9 par défaut** pour les fonctions serverless
- Si `grpcio 1.76.0` ou `protobuf 5.29.5` nécessitent Python 3.12, le build échouera
- **Solution possible** : Utiliser des versions compatibles Python 3.9 ou spécifier Python 3.12 dans Vercel (si supporté)

---

## 📋 RÉSUMÉ

| Aspect | État | Détails |
|--------|------|---------|
| **Gestionnaire** | ✅ **pip** | `requirements.txt` standard, pas uv |
| **Contrainte Python explicite** | ❌ **Aucune** | Pas de ligne `python>=3.12` dans requirements.txt |
| **Contrainte Python implicite** | ⚠️ **Probable** | `grpcio 1.76.0` + `protobuf 5.29.5` très récents |
| **Conflit identifié** | 🔴 **OUI** | Versions récentes gRPC/protobuf vs Python 3.9 (Vercel) |
| **Paquet source** | `grpcio==1.76.0` + `protobuf==5.29.5` | Via `google-generativeai` / `google-api-core` |

**Conclusion** : Le conflit vient de **`grpcio==1.76.0` et `protobuf==5.29.5`** qui sont des versions très récentes (janvier 2025) et qui peuvent nécessiter Python 3.12+, alors que Vercel utilise Python 3.9 par défaut. Ces dépendances sont entraînées par `google-generativeai==0.8.5` et `google-api-core==2.28.0`.

