# 📋 INSTRUCTIONS POUR EXÉCUTER LE TEST DES INDEXES

**Date**: 23 Janvier 2026

---

## 🚀 MÉTHODE RECOMMANDÉE

### Option 1: Utiliser l'environnement virtuel du projet

Si vous avez un environnement virtuel configuré avec toutes les dépendances :

```bash
# Activer l'environnement virtuel
# (selon votre configuration: venv, conda, etc.)

# Puis exécuter
python backend/scripts/test_index_usage_standalone.py
```

### Option 2: Installer motor temporairement

```bash
pip install motor
python backend/scripts/test_index_usage_standalone.py
```

### Option 3: Exécuter depuis l'environnement de production

Si vous avez accès à l'environnement où le backend tourne (avec toutes les dépendances installées) :

```bash
python backend/scripts/test_index_usage_standalone.py
```

---

## 📝 VARIABLES D'ENVIRONNEMENT REQUISES

Le script utilise ces variables d'environnement :

```bash
MONGO_URL=mongodb://localhost:27017  # ou votre URL MongoDB
DB_NAME=retail_coach                  # ou votre nom de DB
```

**Windows PowerShell**:
```powershell
$env:MONGO_URL="mongodb://localhost:27017"
$env:DB_NAME="retail_coach"
python backend/scripts/test_index_usage_standalone.py
```

**Linux/Mac**:
```bash
export MONGO_URL="mongodb://localhost:27017"
export DB_NAME="retail_coach"
python backend/scripts/test_index_usage_standalone.py
```

---

## ✅ RÉSULTATS ATTENDUS

### Succès (2/2 checks) :

```
================================================================================
VALIDATION
================================================================================
OK CHECK 1: Stage = IXSCAN (Index Scan) - Index utilise correctement!
OK CHECK 2: Ratio documents retournes/examines = 96.67% (>=80%)
   OK: Index tres efficace - Peu de documents inutiles examines!

================================================================================
RESUME
================================================================================
Checks reussis: 2/2

SUCCES: L'index est utilise correctement et efficacement!
   OK: Les requetes batch de la Vague 2 beneficieront de cette optimisation.
```

### Échec (0/2 checks) :

```
ECHEC CHECK 1: Stage = COLLSCAN (Collection Scan) - Index NON utilise!
   ATTENTION: La requete scanne toute la collection - Performance degradee!

ECHEC: L'index n'est pas utilise correctement.
   Verifiez que l'index manager_date_store_idx a bien ete cree.
   Executez: python backend/scripts/init_db_indexes.py
```

---

## 🔧 DÉPANNAGE

### Erreur: "ModuleNotFoundError: No module named 'motor'"

**Solution**: Installez motor
```bash
pip install motor
```

### Erreur: "Connection refused" ou "Timeout"

**Solution**: Vérifiez que MongoDB est accessible
```bash
# Tester la connexion
mongosh "mongodb://localhost:27017"
```

### Erreur: "Collection manager_kpis not found"

**Solution**: C'est normal si la collection est vide. Le test fonctionnera quand même.

---

## 📊 INTERPRÉTATION

- **Stage = IXSCAN**: ✅ Index utilisé → Performance optimale
- **Stage = COLLSCAN**: ❌ Collection scan → Performance dégradée
- **Ratio ≥ 80%**: ✅ Index très efficace
- **Ratio < 50%**: ⚠️ Index pourrait être optimisé

---

*Instructions créées le 23 Janvier 2026*
