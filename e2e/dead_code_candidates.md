# Candidats au code mort (non importés après refactorisation)

Fichiers **suivis par Git** qui ne sont **jamais importés** par l’application (backend ou frontend).  
À confirmer avant suppression.

---

## Backend (.py)

| Fichier | Statut | Remarque |
|---------|--------|----------|
| `backend/core/ownership_check_example.py` | **Non importé** | Exemple/documentation uniquement. Référencé dans des docs d’archive. Aucun `import` dans `api/`, `main.py` ou `lifespan.py`. |

Les autres modules backend listés (repositories, services, routes, config, core sauf ownership_check_example) sont bien importés via `api/routes/__init__.py`, `main.py` ou `lifespan.py`.

---

## Frontend (.js / .jsx)

Les composants et pages listés dans `.gitignore` (section « Fichiers/dossiers non utilisés ») sont déjà **exclus du suivi** (DiagnosticForm.js, ObjectivesAndChallengesModal.js, etc.).  
Aucun fichier **actuellement suivi** n’a été détecté comme jamais importé (tous les composants/pages suivis sont référencés depuis `App.js` ou d’autres composants).

---

## Tests et scripts

- `backend/tests/debug_reset_token.py` : script de test/debug, pas importé par l’app (normal).
- Scripts `test_sophie_*.sh`, `test_app_after_cleanup.sh` : ajoutés au `.gitignore` et retirés du suivi Git pour ne plus être analysés par Sonar.

---

## Action recommandée

1. **À supprimer ou déplacer (après validation)**  
   - `backend/core/ownership_check_example.py`  
   - Soit suppression, soit déplacement vers `docs/` ou `backend/_archived_legacy/` si vous souhaitez garder l’exemple.

2. **Déjà géré**  
   - `backups/` : déjà dans `.gitignore`, non suivi.  
   - Scripts .sh d’archive : ajoutés au `.gitignore` et retirés de l’index avec `git rm --cached`.
