# 📘 Résumé - Implémentation Notice PDF API Intégrations

## ✅ Fichiers créés/modifiés

### 📄 Fichiers créés

1. **`docs/NOTICE_API_INTEGRATIONS.md`**
   - Notice d'utilisation complète en markdown
   - Documente tous les endpoints CRUD intégrations
   - Exemples cURL et Python pour chaque endpoint
   - FAQ et bonnes pratiques

2. **`backend/api/routes/docs.py`**
   - Nouveau router pour la génération de PDF
   - Endpoint `GET /api/docs/integrations.pdf`
   - Requiert authentification gérant
   - Convertit markdown → HTML → PDF

3. **`RESUME_IMPLEMENTATION_NOTICE_PDF.md`**
   - Documentation de l'implémentation

### 🔧 Fichiers modifiés

1. **`backend/api/routes/__init__.py`**
   ```python
   safe_import('api.routes.docs', 'router')  # Ajouté
   ```

2. **`backend/requirements.txt`**
   ```
   xhtml2pdf==0.2.15  # Ajouté
   ```

3. **`frontend/src/components/gerant/APIDocModal.js`**
   - Import de `Download` icon et `API_BASE`
   - Fonction `handleDownloadPDF()` ajoutée
   - Bouton "Télécharger en PDF" dans le footer

---

## 🔍 Détails des modifications

### Backend - Endpoint PDF

**Fichier** : `backend/api/routes/docs.py`

**Endpoint** : `GET /api/docs/integrations.pdf`

**Authentification** : Requiert JWT Bearer (gérant uniquement)

**Fonctionnement** :
1. Lit `docs/NOTICE_API_INTEGRATIONS.md`
2. Convertit markdown en HTML avec `markdown` library
3. Ajoute des styles CSS pour le PDF
4. Convertit HTML en PDF avec `xhtml2pdf.pisa`
5. Retourne le PDF avec `Content-Type: application/pdf`

**Code clé** :
```python
@router.get("/integrations.pdf")
async def get_integrations_pdf(
    current_user: Dict = Depends(get_current_gerant)
):
    # Lecture du markdown
    with open(md_path, "r", encoding="utf-8") as f:
        md_content = f.read()
    
    # Conversion markdown → HTML
    html_content = markdown.markdown(md_content, extensions=['extra', 'codehilite', 'tables', 'toc'])
    
    # Conversion HTML → PDF
    pisa.CreatePDF(styled_html, dest=pdf_buffer, encoding='utf-8')
    
    # Retour du PDF
    return Response(content=pdf_content, media_type="application/pdf", ...)
```

### Frontend - Bouton PDF

**Fichier** : `frontend/src/components/gerant/APIDocModal.js`

**Modifications** :
- Import de `Download` icon et `API_BASE`
- Fonction `handleDownloadPDF()` qui :
  1. Récupère le token JWT depuis localStorage
  2. Appelle `GET /api/docs/integrations.pdf`
  3. Télécharge le blob PDF

**Code ajouté** :
```javascript
const handleDownloadPDF = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/api/docs/integrations.pdf`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const blob = await response.blob();
  // Téléchargement du PDF
};
```

---

## 🧪 Tests

### Test local

#### 1. Installer les dépendances

```bash
cd backend
pip install -r requirements.txt
```

#### 2. Démarrer le serveur

```bash
uvicorn main:app --reload
```

#### 3. Tester l'endpoint PDF

**Option A - Avec curl** :
```bash
# Récupérer un token JWT (gérant)
TOKEN="votre_token_jwt_gerant"

# Tester l'endpoint
curl -X GET "http://localhost:8000/api/docs/integrations.pdf" \
  -H "Authorization: Bearer $TOKEN" \
  -o notice.pdf

# Vérifier le Content-Type
curl -I -X GET "http://localhost:8000/api/docs/integrations.pdf" \
  -H "Authorization: Bearer $TOKEN"
```

**Résultat attendu** :
- Status: `200 OK`
- Content-Type: `application/pdf`
- Fichier PDF téléchargeable et lisible

**Option B - Depuis l'interface** :
1. Démarrer le frontend : `npm start` (dans `frontend/`)
2. Se connecter en tant que gérant
3. Ouvrir le modal "Guide d'Intégration API"
4. Cliquer sur "Télécharger en PDF"
5. Vérifier que le PDF se télécharge

### Test en production

1. **Déployer les changements** (Vercel/autre plateforme)
2. **Installer les dépendances** :
   ```bash
   pip install xhtml2pdf
   ```
3. **Tester depuis l'interface** :
   - Se connecter en tant que gérant
   - Ouvrir le modal "Guide d'Intégration API"
   - Cliquer sur "Télécharger en PDF"
   - Vérifier que le PDF se télécharge correctement

### Test automatisé (optionnel)

Créer `backend/tests/test_docs_pdf.py` :

```python
import pytest
from fastapi.testclient import TestClient

def test_integrations_pdf_requires_auth(client: TestClient):
    """Test that PDF endpoint requires authentication"""
    response = client.get("/api/docs/integrations.pdf")
    assert response.status_code == 401

def test_integrations_pdf_requires_gerant(client: TestClient, gerant_token):
    """Test that PDF endpoint requires gérant role"""
    response = client.get(
        "/api/docs/integrations.pdf",
        headers={"Authorization": f"Bearer {gerant_token}"}
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 0
```

---

## 📋 Checklist de déploiement

- [x] Notice markdown créée (`docs/NOTICE_API_INTEGRATIONS.md`)
- [x] Endpoint backend créé (`backend/api/routes/docs.py`)
- [x] Router ajouté (`backend/api/routes/__init__.py`)
- [x] Dépendance ajoutée (`backend/requirements.txt`)
- [x] Bouton PDF ajouté dans le frontend (`APIDocModal.js`)
- [ ] Tests locaux effectués
- [ ] Tests en production effectués
- [ ] Vérification que le PDF est lisible et bien formaté

---

## ⚠️ Notes importantes

### Dépendances

- **`xhtml2pdf`** : Bibliothèque Python pour convertir HTML en PDF
- **`markdown`** : Déjà installé, utilisé pour parser le markdown
- **`reportlab`** : Dépendance de `xhtml2pdf` (installée automatiquement)

### Limitations

- **xhtml2pdf** a des limitations CSS (pas de flexbox, grid, etc.)
- Les styles sont basiques mais fonctionnels pour une documentation
- Pour un rendu plus avancé, considérer `weasyprint` (nécessite des dépendances système)

### Alternative (si xhtml2pdf ne fonctionne pas en production)

Si `xhtml2pdf` pose des problèmes en production (Vercel), alternatives :

1. **Client-side** : Utiliser `jsPDF` + `html2canvas` côté frontend
2. **Service externe** : Utiliser un service comme `pdfkit` + `wkhtmltopdf` (nécessite un serveur)
3. **WeasyPrint** : Plus robuste mais nécessite des dépendances système (cairo, pango)

---

## 🚀 Commandes de test rapides

### Local

```bash
# Backend
cd backend
pip install xhtml2pdf
uvicorn main:app --reload

# Dans un autre terminal - Test curl
TOKEN="votre_token"
curl -X GET "http://localhost:8000/api/docs/integrations.pdf" \
  -H "Authorization: Bearer $TOKEN" \
  -o test_notice.pdf

# Vérifier le fichier
file test_notice.pdf  # Devrait afficher "PDF document"
```

### Production

1. Ouvrir l'interface gérant
2. Cliquer sur "Guide d'Intégration API"
3. Cliquer sur "Télécharger en PDF"
4. Vérifier que le PDF se télécharge correctement

---

## 📝 Structure de la notice

La notice `docs/NOTICE_API_INTEGRATIONS.md` contient :

1. **À quoi sert l'API Intégrations** - Vue d'ensemble
2. **Pré-requis** - Rôle gérant, création clé, récupération
3. **Authentification** - X-API-Key et alias Authorization
4. **Permissions & Store IDs** - Explications détaillées avec exemples
5. **Base URL** - `https://api.retailperformerai.com`
6. **Endpoints** (6 endpoints documentés) :
   - GET /api/integrations/stores
   - POST /api/integrations/stores
   - POST /api/integrations/stores/{store_id}/managers
   - POST /api/integrations/stores/{store_id}/sellers
   - PUT /api/integrations/users/{user_id}
   - POST /api/integrations/kpi/sync
7. **FAQ / Erreurs fréquentes** - 401, 403, 400, 404
8. **Bonnes pratiques** - Rotation clés, permissions, logs

---

**Date** : 2025-01-XX  
**Auteur** : Cursor AI

