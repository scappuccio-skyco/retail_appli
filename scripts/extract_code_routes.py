#!/usr/bin/env python3
"""
Script pour extraire les routes depuis le code source (grep sur @router.*)
Usage: python scripts/extract_code_routes.py > routes.code.json
"""
import re
import json
import os
from pathlib import Path
from datetime import datetime
from collections import defaultdict

backend_routes_dir = Path(__file__).parent.parent / "backend" / "api" / "routes"

routes = []
router_prefixes = {}

# Patterns pour extraire les routes
router_pattern = re.compile(r'router\s*=\s*APIRouter\(.*?prefix=["\']([^"\']+)["\']', re.DOTALL)
route_decorator_pattern = re.compile(r'@router\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']', re.IGNORECASE)

def extract_routes_from_file(file_path):
    """Extrait les routes depuis un fichier Python"""
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"Error reading {file_path}: {e}", file=sys.stderr)
        return []
    
    # Extraire le prefix du router
    prefix_match = router_pattern.search(content)
    prefix = prefix_match.group(1) if prefix_match else ""
    
    file_routes = []
    
    # Trouver tous les décorateurs @router.method("path")
    for match in route_decorator_pattern.finditer(content):
        method = match.group(1).upper()
        route_path = match.group(2)
        
        # Construire le chemin complet
        full_path = f"/api{prefix}{route_path}"
        # Normaliser les doubles slashes
        full_path = re.sub(r'/+', '/', full_path)
        
        file_routes.append({
            "path": full_path,
            "method": method,
            "file": str(file_path.relative_to(backend_routes_dir.parent.parent)),
            "prefix": prefix,
            "route_path": route_path,
        })
    
    return file_routes

if __name__ == "__main__":
    if not backend_routes_dir.exists():
        print(f"Error: {backend_routes_dir} does not exist", file=sys.stderr)
        sys.exit(1)
    
    all_routes = []
    
    # Parcourir tous les fichiers Python dans api/routes
    for py_file in backend_routes_dir.glob("*.py"):
        if py_file.name.startswith("__"):
            continue
        routes_in_file = extract_routes_from_file(py_file)
        all_routes.extend(routes_in_file)
    
    # Trier
    all_routes.sort(key=lambda x: (x["path"], x["method"]))
    
    output = {
        "generated_at": datetime.now().isoformat(),
        "source": "code_extraction",
        "total_routes": len(all_routes),
        "routes": all_routes
    }
    
    print(json.dumps(output, indent=2, ensure_ascii=False))

