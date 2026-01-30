# 🎯 PROMPT COURT - AGENT IA PROJET B

**Tu es l'agent IA responsable du Projet B (qui fonctionne sur Vercel).**

Nous effectuons un audit comparatif pour identifier pourquoi le Projet A a des problèmes (routing `/api/*` → `index.html`, build uv "No solution found").

**Fournis les 10 éléments suivants dans ce format** :

```markdown
## PROJET B - Configuration

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
google-genai==X.X.X (ou "ABSENT")
google-generativeai==X.X.X
mangum==X.X.X

### 5. api/index.py
[paste content]

### 6. backend/main.py (extrait app.include_router)
[paste 5-7 lignes autour de include_router]

### 7. frontend/package.json (scripts)
[paste scripts section]

### 8. Structure dossiers racine
- api/ ✅/❌
- backend/ ✅/❌
- frontend/ ✅/❌

### 9. frontend/vercel.json
[paste content ou "ABSENT"]

### 10. Vercel Dashboard Settings
- Root Directory: [valeur ou "vide"]
- Build Command: [valeur]
- Output Directory: [valeur]
```

**Commandes rapides** :
```bash
cat vercel.json
cat runtime.txt 2>/dev/null || echo "ABSENT"
cat requirements.txt
grep -E "^(google-api-core|grpcio|grpcio-status|protobuf|google-genai|google-generativeai|mangum)" backend/requirements.txt
cat api/index.py
grep -A 5 "include_router" backend/main.py
cat frontend/package.json | grep -A 10 '"scripts"'
cat frontend/vercel.json 2>/dev/null || echo "ABSENT"
```

**Merci ! Ces éléments permettront d'identifier la cause racine et de corriger le Projet A.** 🙏

