#!/usr/bin/env python3
"""
Script pour extraire les routes depuis le code source (sans importer l'app).

Usage:
    python scripts/extract_routes_from_code.py > routes.code.json

Ce script parse les fichiers Python pour extraire les définitions de routes.
"""
import re
import json
import os
from pathlib import Path
from typing import List, Dict, Set
from collections import defaultdict

# Chemin du projet
PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
ROUTES_DIR = BACKEND_DIR / "api" / "routes"


def extract_router_prefix(file_path: Path) -> str:
    """Extrait le prefix du router depuis un fichier de routes."""
    content = file_path.read_text(encoding='utf-8')
    
    # Chercher APIRouter(prefix="...")
    match = re.search(r'APIRouter\(prefix=["\']([^"\']+)["\']', content)
    if match:
        return match.group(1)
    
    # Chercher router = APIRouter(prefix="...")
    match = re.search(r'router\s*=\s*APIRouter\(prefix=["\']([^"\']+)["\']', content)
    if match:
        return match.group(1)
    
    return ""


def extract_routes_from_file(file_path: Path, router_prefix: str) -> List[Dict]:
    """Extrait toutes les routes d'un fichier."""
    content = file_path.read_text(encoding='utf-8')
    routes = []
    
    # Pattern pour @router.get/post/put/delete/patch("...")
    pattern = r'@router\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']'
    
    for match in re.finditer(pattern, content):
        method = match.group(1).upper()
        path = match.group(2)
        
        # Construire le chemin complet
        full_path = f"{router_prefix}{path}"
        
        # Normaliser le chemin
        if not full_path.startswith('/'):
            full_path = '/' + full_path
        
        # Extraire les tags (optionnel)
        tags = []
        tag_match = re.search(r'tags=\[([^\]]+)\]', content[max(0, match.start()-200):match.end()])
        if tag_match:
            tags = [t.strip().strip('"\'') for t in tag_match.group(1).split(',')]
        
        # Vérifier si deprecated
        deprecated = False
        deprecated_match = re.search(r'deprecated\s*=\s*True', content[max(0, match.start()-200):match.end()])
        if deprecated_match:
            deprecated = True
        
        # Extraire le nom de la fonction (optionnel)
        func_name = ""
        func_match = re.search(r'async def (\w+)', content[match.end():match.end()+200])
        if func_match:
            func_name = func_match.group(1)
        
        routes.append({
            "path": full_path,
            "methods": [method],
            "name": func_name,
            "tags": tags,
            "deprecated": deprecated,
            "file": str(file_path.relative_to(PROJECT_ROOT))
        })
    
    return routes


def extract_all_routes() -> Dict:
    """Extrait toutes les routes depuis le code source."""
    all_routes = []
    router_files = {}
    
    # Parcourir tous les fichiers de routes
    if not ROUTES_DIR.exists():
        print(f"Error: Routes directory not found: {ROUTES_DIR}", file=sys.stderr)
        return {"routes": [], "error": "Routes directory not found"}
    
    for route_file in ROUTES_DIR.glob("*.py"):
        if route_file.name == "__init__.py":
            continue
        
        router_prefix = extract_router_prefix(route_file)
        routes = extract_routes_from_file(route_file, router_prefix)
        
        if routes:
            router_files[route_file.name] = {
                "prefix": router_prefix,
                "routes_count": len(routes)
            }
            all_routes.extend(routes)
    
    # Trier par path puis method
    all_routes.sort(key=lambda x: (x["path"], x["methods"]))
    
    return {
        "base_url": "https://api.retailperformerai.com",
        "source": "code_parsing",
        "total_routes": len(all_routes),
        "router_files": router_files,
        "routes": all_routes
    }


if __name__ == "__main__":
    import sys
    
    try:
        result = extract_all_routes()
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

