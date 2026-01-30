# 📋 PROMPT POUR AGENT IA - PROJET B

**Contexte** : Audit comparatif entre deux projets Vercel pour identifier la cause racine d'un problème de routing et build sur le Projet A.

---

## 🎯 OBJECTIF

Nous avons besoin de comparer votre projet (Projet B - qui fonctionne) avec un autre projet (Projet A - qui a des problèmes) pour identifier les différences de configuration qui causent :
1. Routing `/api/*` qui renvoie `index.html` au lieu de la fonction serverless Python
2. Build Vercel qui échoue avec "No solution found when resolving dependencies" (uv)

**Objectif final** : Reproduire la configuration gagnante du Projet B dans le Projet A.

---

## 📄 FICHIERS / SETTINGS À FOURNIR

Fournissez les **10 éléments suivants** dans ce format exact :

### 1. `vercel.json` (à la racine du repo)

**Commande** :
```bash
cat vercel.json
```

**Ou si le fichier est ailleurs** : indiquer le chemin complet et le contenu.

---

### 2. `runtime.txt` (à la racine, si présent)

**Commande** :
```bash
cat runtime.txt
```

**Ou confirmer** : `ABSENT` si le fichier n'existe pas.

---

### 3. `requirements.txt` (à la racine)

**Commande** :
```bash
cat requirements.txt
```

**Contenu complet attendu** : Peut être une liste directe de dépendances ou une référence `-r backend/requirements.txt`.

---

### 4. `backend/requirements.txt` (si présent)

**Extraits des lignes clés** (ou fichier complet si < 50 lignes) :
```bash
grep -E "^(google-api-core|grpcio|grpcio-status|protobuf|google-genai|google-generativeai|mangum)" backend/requirements.txt
```

**Ou fichier complet** :
```bash
cat backend/requirements.txt
```

**Fichiers recherchés** : Si le backend est dans un autre dossier (`app/`, `src/`, etc.), fournir le chemin correct.

---

### 5. `api/index.py` (ou équivalent - entrée serverless Python)

**Commande** :
```bash
cat api/index.py
```

**Si dans un autre dossier** :
```bash
# Chercher le fichier handler serverless Python
find . -name "index.py" -path "*/api/*" -o -path "*/functions/*"
cat [chemin_trouvé]
```

**Fichiers alternatifs possibles** :
- `functions/api/index.py`
- `api/index.py`
- `serverless/index.py`
- Autre structure (préciser)

---

### 6. `backend/main.py` (extrait : configuration FastAPI)

**Extrait autour de `app.include_router`** :
```bash
grep -A 5 -B 2 "app.include_router\|include_router" backend/main.py
```

**Ou si FastAPI est configuré différemment** : fournir les lignes où les routers sont enregistrés.

**Question clé** : Le préfixe `/api` est-il ajouté dans FastAPI (`app.include_router(router, prefix="/api")`) ou uniquement dans Vercel rewrites ?

---

### 7. `frontend/package.json` (extrait : scripts)

**Extrait des scripts uniquement** :
```bash
cat frontend/package.json | grep -A 10 '"scripts"'
```

**Ou fournir manuellement** : Section `"scripts"` du fichier.

---

### 8. Structure des dossiers à la racine

**Commande** :
```bash
ls -la | grep "^d" | awk '{print $NF}' | grep -v "^\." | sort
```

**Ou liste manuelle** :
```
- api/ ✅ (présent) ou ❌ (absent)
- backend/ ✅ ou ❌
- frontend/ ✅ ou ❌
- app/ ✅ ou ❌
- pages/ ✅ ou ❌
- functions/ ✅ ou ❌
- (autres dossiers pertinents)
```

**Question** : Quelle est la structure du monorepo ? (api/, backend/, frontend/ séparés ou autre organisation ?)

---

### 9. `frontend/vercel.json` (si présent)

**Commande** :
```bash
cat frontend/vercel.json 2>/dev/null || echo "ABSENT"
```

**Ou confirmer** : `ABSENT` si le fichier n'existe pas.

**Question clé** : Y a-t-il une configuration Vercel dans le dossier frontend qui pourrait entrer en conflit avec la config racine ?

---

### 10. Vercel Dashboard Settings (3 champs critiques)

**À vérifier dans Vercel Dashboard → Settings → General** :

1. **Root Directory** :
   - Champ : "Root Directory"
   - Valeur : `(vide)` ou `frontend/` ou autre valeur ?
   - **IMPORTANT** : Ce setting peut expliquer pourquoi `/api/*` fonctionne ou non

2. **Build Command** :
   - Champ : "Build Command"
   - Valeur exacte : `cd frontend && yarn build` ou autre ?

3. **Output Directory** :
   - Champ : "Output Directory"
   - Valeur exacte : `frontend/build` ou autre ?

**Note** : Ces valeurs peuvent différer de `vercel.json` si elles sont définies explicitement dans le Dashboard.

---

## 📝 FORMAT DE RÉPONSE ATTENDU

Répondez dans ce format (copiez-collez et remplissez) :

```markdown
## PROJET B - Éléments de Configuration

### 1. vercel.json (racine)
```
[paste content complet]
```

### 2. runtime.txt
```
[paste content ou "ABSENT"]
```

### 3. requirements.txt (racine)
```
[paste content complet]
```

### 4. backend/requirements.txt (extraits clés)
```
google-api-core==X.X.X
grpcio==X.X.X
grpcio-status==X.X.X
protobuf==X.X.X
google-genai==X.X.X (ou "ABSENT" si non présent)
google-generativeai==X.X.X
mangum==X.X.X
```
*(ou fichier complet si plus simple)*

### 5. api/index.py (ou équivalent)
```
[paste content complet]
```

### 6. backend/main.py (extrait app.include_router)
```
[paste lines autour de app.include_router - environ 5-7 lignes]
```

### 7. frontend/package.json (scripts)
```json
{
  "scripts": {
    [paste scripts section]
  }
}
```

### 8. Structure dossiers racine
- api/ ✅/❌
- backend/ ✅/❌
- frontend/ ✅/❌
- app/ ✅/❌
- pages/ ✅/❌
- functions/ ✅/❌
- (autres dossiers pertinents)

### 9. frontend/vercel.json
```
[paste content ou "ABSENT"]
```

### 10. Vercel Dashboard Settings
- Root Directory: [valeur exacte ou "vide"]
- Build Command: [valeur exacte]
- Output Directory: [valeur exacte]
```

---

## ⚡ ALTERNATIVE RAPIDE

Si vous préférez, vous pouvez créer un archive avec tous les fichiers :

```bash
# Dans le repo du Projet B
tar -czf projet-b-config.tar.gz \
  vercel.json \
  runtime.txt \
  requirements.txt \
  backend/requirements.txt \
  api/index.py \
  backend/main.py \
  frontend/package.json \
  frontend/vercel.json 2>/dev/null
```

Puis partager le contenu de chaque fichier extrait.

---

## ❓ QUESTIONS DE CLARIFICATION (si nécessaire)

Si certains fichiers n'existent pas ou ont des noms différents :

1. **Structure différente** : Si `backend/` s'appelle `app/`, `src/`, `server/`, etc., indiquez le chemin correct
2. **Pas de séparation backend/frontend** : Si tout est dans un seul dossier, décrivez la structure
3. **Pas de fichier `api/index.py`** : Indiquez où se trouve le handler serverless Python (peut être `functions/`, `serverless/`, etc.)
4. **Configuration différente** : Si vous utilisez Next.js API routes ou une autre structure, décrivez-la

---

## 🎯 IMPORTANCE DE CES ÉLÉMENTS

Chacun de ces éléments est critique pour identifier :

- **vercel.json** : Routing et build configuration
- **runtime.txt** : Version Python utilisée
- **requirements.txt** : Structure des dépendances
- **backend/requirements.txt** : Versions exactes (conflits uv)
- **api/index.py** : Structure du handler serverless
- **backend/main.py** : Préfixage FastAPI (éviter double `/api`)
- **frontend/package.json** : Commandes build
- **Structure dossiers** : Organisation monorepo
- **frontend/vercel.json** : Conflits potentiels
- **Vercel Dashboard Settings** : Settings explicites qui override vercel.json

**Merci de fournir ces informations pour permettre une comparaison précise et identifier la cause racine du problème !** 🙏

