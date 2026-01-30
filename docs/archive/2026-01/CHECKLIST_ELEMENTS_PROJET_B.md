# 📋 CHECKLIST - Éléments Nécessaires du Projet B

**Objectif** : Comparer le Projet B (qui fonctionne) avec le Projet A (qui casse)

---

## 📄 Fichiers à fournir (10 éléments)

### 1. `vercel.json` (racine du repo)

**Contenu complet du fichier** :
```bash
cat vercel.json
```

**Pourquoi nécessaire** : Comparer la configuration Vercel principale (rewrites, buildCommand, outputDirectory, Root Directory)

---

### 2. `runtime.txt` (racine, si présent)

**Commande** :
```bash
cat runtime.txt  # ou confirmer absence
```

**Pourquoi nécessaire** : Vérifier si le Projet B utilise Python 3.11, 3.12, ou laisse Vercel auto-détecter

---

### 3. `requirements.txt` (racine)

**Contenu complet** :
```bash
cat requirements.txt
```

**Pourquoi nécessaire** : Comparer la structure (référence `-r backend/requirements.txt` ou liste directe?)

---

### 4. `backend/requirements.txt` (si présent)

**Extraits des lignes clés** :
```bash
grep -E "^(google-api-core|grpcio|grpcio-status|protobuf|google-genai|google-generativeai|mangum)" backend/requirements.txt
```

**Ou fichier complet si < 50 lignes** :
```bash
cat backend/requirements.txt
```

**Pourquoi nécessaire** : Comparer versions Google/gRPC/protobuf, vérifier cohérence (grpcio vs grpcio-status), packages redondants

---

### 5. `api/index.py` (ou équivalent - entrée serverless Python)

**Contenu complet** :
```bash
cat api/index.py
# ou si dans un autre dossier:
cat functions/api/index.py
# ou:
find . -name "index.py" -path "*/api/*" -o -path "*/functions/*"
```

**Pourquoi nécessaire** : Comparer structure du handler serverless (imports, path setup, handler Mangum)

---

### 6. `backend/main.py` (extrait: configuration FastAPI)

**Extrait autour de `app.include_router`** :
```bash
grep -A 5 "app.include_router\|include_router" backend/main.py
```

**Pourquoi nécessaire** : Vérifier si FastAPI ajoute un préfixe `/api` ou non (éviter double préfixe)

---

### 7. `frontend/package.json` (extrait: scripts)

**Extrait des scripts** :
```bash
cat frontend/package.json | grep -A 10 '"scripts"'
```

**Pourquoi nécessaire** : Comparer commandes build (yarn build, npm run build, craco build, etc.)

---

### 8. Structure des dossiers à la racine

**Commande** :
```bash
ls -la | grep "^d" | awk '{print $NF}' | grep -v "^\." | sort
```

**Ou simplement liste manuelle** :
- `api/` (présent/absent)
- `backend/` (présent/absent)
- `frontend/` (présent/absent)
- `app/` (présent/absent)
- `pages/` (présent/absent)
- Autres dossiers pertinents

**Pourquoi nécessaire** : Vérifier organisation monorepo, structure similaire ou différente de A

---

### 9. `frontend/vercel.json` (si présent)

**Contenu complet ou confirmation d'absence** :
```bash
cat frontend/vercel.json 2>/dev/null || echo "FILE_NOT_PRESENT"
```

**Pourquoi nécessaire** : Vérifier si B a aussi ce fichier (potentiel conflit avec config racine)

---

### 10. Vercel Dashboard Settings (3 champs)

**À vérifier dans Vercel Dashboard → Settings → General** :

1. **Root Directory** :
   - Valeur : `(vide)` ou `frontend/` ou autre?
   - Champ : "Root Directory"

2. **Build Command** :
   - Valeur exacte (peut différer de vercel.json)
   - Champ : "Build Command"

3. **Output Directory** :
   - Valeur exacte (peut différer de vercel.json)
   - Champ : "Output Directory"

**Pourquoi nécessaire** : Comparer settings explicites vs implicites, vérifier si Root Directory est défini (impact majeur sur routing)

---

## 🎯 Format de réponse suggéré

Pour faciliter la comparaison, fournir dans ce format :

```markdown
## PROJET B - Éléments

### 1. vercel.json (racine)
[paste content]

### 2. runtime.txt
[paste content ou "ABSENT"]

### 3. requirements.txt (racine)
[paste content]

### 4. backend/requirements.txt (extraits clés)
google-api-core==X.X.X
grpcio==X.X.X
grpcio-status==X.X.X
protobuf==X.X.X
google-genai==X.X.X (ou ABSENT)
google-generativeai==X.X.X
mangum==X.X.X

### 5. api/index.py
[paste content]

### 6. backend/main.py (extrait)
[paste lines around app.include_router]

### 7. frontend/package.json (scripts)
[paste scripts section]

### 8. Structure dossiers
- api/ ✅
- backend/ ✅
- frontend/ ✅
- (autres)

### 9. frontend/vercel.json
[paste content ou "ABSENT"]

### 10. Vercel Dashboard Settings
- Root Directory: [valeur]
- Build Command: [valeur]
- Output Directory: [valeur]
```

---

## ⚡ Alternative rapide (si repo accessible)

Si le repo B est accessible (GitHub, local), fournir simplement :

```bash
# Dans le repo B
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

Puis partager le contenu de ces fichiers.

