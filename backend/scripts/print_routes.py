#!/usr/bin/env python3
"""
Script pour lister toutes les routes FastAPI au runtime
Extrait les routes depuis l'instance app (source de vérité au runtime)

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
    
    # Extraire les routes directement depuis app.routes
    routes_list = []
    
    def dump_routes(app_instance):
        """Extract route information from FastAPI app instance"""
        out = []
        for route in app_instance.routes:
            # Skip non-route objects (middleware, etc.)
            if not hasattr(route, "path"):
                continue
            
            methods = sorted(getattr(route, "methods", set()))
            # Skip OPTIONS and HEAD
            methods = [m for m in methods if m not in ["OPTIONS", "HEAD"]]
            
            if not methods:
                continue
            
            path = getattr(route, "path", "")
            name = getattr(route, "name", "")
            
            # Get dependencies
            dependencies = []
            if hasattr(route, "dependant"):
                deps = getattr(route.dependant, "dependencies", [])
                for dep in deps:
                    if hasattr(dep, "call"):
                        dep_name = getattr(dep.call, "__name__", str(dep.call))
                        dependencies.append(dep_name)
            
            # Get tags from route
            tags = []
            if hasattr(route, "tags"):
                tags = list(route.tags) if route.tags else []
            
            # Check if deprecated
            deprecated = getattr(route, "deprecated", False)
            
            # Get include_in_schema
            include_in_schema = getattr(route, "include_in_schema", True)
            
            # For each HTTP method, create a route entry
            for method in methods:
                route_info = {
                    "path": path,
                    "method": method,
                    "name": name,
                    "tags": tags,
                    "dependencies": dependencies,
                    "deprecated": deprecated,
                    "include_in_schema": include_in_schema
                }
                out.append(route_info)
        
        return out
    
    routes_list = dump_routes(app)
    
    # Also get OpenAPI schema for additional metadata
    try:
        openapi_schema = app.openapi()
        openapi_paths = openapi_schema.get("paths", {})
        
        # Enrich routes with OpenAPI metadata
        routes_dict = {(r["path"], r["method"]): r for r in routes_list}
        
        for path, methods in openapi_paths.items():
            for method, details in methods.items():
                if method.upper() in ["HEAD", "OPTIONS"]:
                    continue
                
                key = (path, method.upper())
                if key in routes_dict:
                    route = routes_dict[key]
                    route["operationId"] = details.get("operationId")
                    route["summary"] = details.get("summary")
                    route["description"] = details.get("description")
                    route["security"] = details.get("security", [])
                    route["parameters"] = details.get("parameters", [])
    except Exception as e:
        print(f"Warning: Could not enrich with OpenAPI schema: {e}", file=sys.stderr)
    
    # Trier par path puis method
    routes_list.sort(key=lambda x: (x["path"], x["method"]))
    
    output = {
        "generated_at": datetime.now().isoformat(),
        "source": "runtime_app_routes",
        "base_url": "https://api.retailperformerai.com",
        "total_routes": len(routes_list),
        "routes": routes_list
    }
    
    print(json.dumps(output, indent=2, ensure_ascii=False))
    
finally:
    os.chdir(original_cwd)
