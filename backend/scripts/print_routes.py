#!/usr/bin/env python3
"""
Script pour lister toutes les routes FastAPI au runtime via OpenAPI schema
Usage: 
  cd backend
  python scripts/print_routes.py > ../../routes.runtime.json
  
  OU depuis la racine avec environnement Python activé:
  python backend/scripts/print_routes.py > routes.runtime.json
"""
import sys
import os
import json
from pathlib import Path
from datetime import datetime

# Ajouter le backend au path
script_dir = Path(__file__).parent
backend_dir = script_dir.parent
root_dir = backend_dir.parent

# Changer vers backend pour que les imports relatifs fonctionnent
original_cwd = os.getcwd()
try:
    os.chdir(backend_dir)
    sys.path.insert(0, str(backend_dir))
    
    try:
        # Essayer d'importer l'app FastAPI
        from main import app
    except Exception as e:
        # Si l'import échoue (dépendances manquantes), créer un script alternatif
        print(f"Error: Cannot import app: {e}", file=sys.stderr)
        print("Hint: Make sure you have activated the Python environment and installed dependencies", file=sys.stderr)
        sys.exit(1)
    
    # Utiliser le schéma OpenAPI pour extraire les routes
    openapi_schema = app.openapi()
    
    routes_list = []
    paths = openapi_schema.get("paths", {})
    
    for path, methods in paths.items():
        # Filtrer seulement les routes /api/* ou /_debug/*
        if not (path.startswith("/api") or path.startswith("/_")):
            continue
            
        for method, details in methods.items():
            if method.upper() in ["HEAD", "OPTIONS"]:
                continue
                
            route_info = {
                "path": path,
                "method": method.upper(),
                "operationId": details.get("operationId"),
                "summary": details.get("summary"),
                "tags": details.get("tags", []),
                "deprecated": details.get("deprecated", False),
                "parameters": details.get("parameters", []),
            }
            
            # Extraire les security requirements
            security = details.get("security", [])
            route_info["security"] = security
            
            routes_list.append(route_info)
    
    # Trier par path puis method
    routes_list.sort(key=lambda x: (x["path"], x["method"]))
    
    output = {
        "generated_at": datetime.now().isoformat(),
        "base_url": "https://api.retailperformerai.com",
        "openapi_version": openapi_schema.get("openapi"),
        "info": {
            "title": openapi_schema.get("info", {}).get("title"),
            "version": openapi_schema.get("info", {}).get("version"),
        },
        "total_routes": len(routes_list),
        "routes": routes_list
    }
    
    print(json.dumps(output, indent=2, ensure_ascii=False))
    
finally:
    os.chdir(original_cwd)
