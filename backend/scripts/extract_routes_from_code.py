#!/usr/bin/env python3
"""
Extract route definitions from Python source code (static analysis).
This script parses Python files without importing them.

Usage:
    python backend/scripts/extract_routes_from_code.py > routes.code.json
"""
import sys
import os
import json
import re
from pathlib import Path
from typing import List, Dict, Set

# Add backend to path
backend_dir = Path(__file__).parent.parent
routes_dir = backend_dir / "api" / "routes"


def find_python_files(directory: Path) -> List[Path]:
    """Find all Python files in a directory"""
    python_files = []
    for root, dirs, files in os.walk(directory):
        # Skip __pycache__
        if '__pycache__' in root:
            continue
        for file in files:
            if file.endswith('.py'):
                python_files.append(Path(root) / file)
    return python_files


def extract_router_prefix(file_path: Path) -> str:
    """Extract router prefix from APIRouter(prefix=...)"""
    try:
        content = file_path.read_text(encoding='utf-8')
        # Match APIRouter(prefix="...")
        match = re.search(r'APIRouter\s*\(\s*prefix\s*=\s*["\']([^"\']+)["\']', content)
        if match:
            return match.group(1)
        # Match router = APIRouter(prefix="...")
        match = re.search(r'router\s*=\s*APIRouter\s*\(\s*prefix\s*=\s*["\']([^"\']+)["\']', content)
        if match:
            return match.group(1)
    except Exception as e:
        print(f"Error reading {file_path}: {e}", file=sys.stderr)
    return ""


def extract_routes_from_file(file_path: Path, router_prefix: str = "") -> List[Dict]:
    """Extract route definitions from a Python file"""
    routes = []
    try:
        content = file_path.read_text(encoding='utf-8')
        
        # Find all @router.get/post/put/delete decorators
        # Pattern: @router.get("path") or @router.get("/path")
        route_pattern = r'@router\.(get|post|put|delete|patch)\s*\(\s*["\']([^"\']+)["\']'
        
        for match in re.finditer(route_pattern, content):
            method = match.group(1).upper()
            path = match.group(2)
            
            # Combine router prefix with route path
            full_path = router_prefix + path if router_prefix else path
            # Ensure path starts with /
            if not full_path.startswith('/'):
                full_path = '/' + full_path
            
            # Try to extract function name (next def after decorator)
            func_match = re.search(r'async def (\w+)', content[match.end():match.end()+200])
            func_name = func_match.group(1) if func_match else ""
            
            # Try to extract tags (simplified)
            tags = []
            if 'tags=' in content[match.start():match.end()+500]:
                tag_match = re.search(r'tags\s*=\s*\[([^\]]+)\]', content[match.start():match.end()+500])
                if tag_match:
                    tag_str = tag_match.group(1)
                    tag_items = re.findall(r'["\']([^"\']+)["\']', tag_str)
                    tags = tag_items
            
            routes.append({
                "path": full_path,
                "name": func_name,
                "methods": [method],
                "tags": tags,
                "dependencies": [],  # Hard to extract statically
                "file": str(file_path.relative_to(backend_dir))
            })
        
        # Also check for diagnostic_router or other router names
        other_router_patterns = [
            r'@diagnostic_router\.(get|post|put|delete|patch)\s*\(\s*["\']([^"\']+)["\']',
        ]
        
        for pattern in other_router_patterns:
            for match in re.finditer(pattern, content):
                method = match.group(1).upper()
                path = match.group(2)
                full_path = router_prefix + path if router_prefix else path
                if not full_path.startswith('/'):
                    full_path = '/' + full_path
                
                func_match = re.search(r'async def (\w+)', content[match.end():match.end()+200])
                func_name = func_match.group(1) if func_match else ""
                
                routes.append({
                    "path": full_path,
                    "name": func_name,
                    "methods": [method],
                    "tags": [],
                    "dependencies": [],
                    "file": str(file_path.relative_to(backend_dir))
                })
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}", file=sys.stderr)
    
    return routes


def extract_routes_from_main(main_file: Path) -> List[Dict]:
    """Extract routes defined directly in main.py (not in routers)"""
    routes = []
    try:
        content = main_file.read_text(encoding='utf-8')
        
        # Pattern for @app.get/post/etc in main.py
        route_pattern = r'@app\.(get|post|put|delete|patch)\s*\(\s*["\']([^"\']+)["\']'
        
        for match in re.finditer(route_pattern, content):
            method = match.group(1).upper()
            path = match.group(2)
            
            if not path.startswith('/'):
                path = '/' + path
            
            func_match = re.search(r'async def (\w+)', content[match.end():match.end()+200])
            func_name = func_match.group(1) if func_match else ""
            
            routes.append({
                "path": path,
                "name": func_name,
                "methods": [method],
                "tags": [],
                "dependencies": [],
                "file": "main.py"
            })
        
    except Exception as e:
        print(f"Error processing {main_file}: {e}", file=sys.stderr)
    
    return routes


def main():
    all_routes = []
    
    # Process routes files
    if routes_dir.exists():
        for route_file in find_python_files(routes_dir):
            if route_file.name == '__init__.py':
                continue
            
            router_prefix = extract_router_prefix(route_file)
            routes = extract_routes_from_file(route_file, router_prefix)
            all_routes.extend(routes)
    
    # Process main.py for direct routes
    main_file = backend_dir / "main.py"
    if main_file.exists():
        main_routes = extract_routes_from_main(main_file)
        all_routes.extend(main_routes)
    
    # Combine routes with same path but different methods
    route_dict = {}
    for route in all_routes:
        key = route["path"]
        if key not in route_dict:
            route_dict[key] = {
                "path": route["path"],
                "name": route.get("name", ""),
                "methods": set(route["methods"]),
                "tags": route.get("tags", []),
                "dependencies": route.get("dependencies", []),
                "file": route.get("file", "")
            }
        else:
            route_dict[key]["methods"].update(route["methods"])
    
    # Convert sets to sorted lists
    routes_list = []
    for route in route_dict.values():
        routes_list.append({
            "path": route["path"],
            "name": route["name"],
            "methods": sorted(list(route["methods"])),
            "tags": route["tags"],
            "dependencies": route["dependencies"],
            "file": route["file"]
        })
    
    # Output as JSON
    output = {
        "total_routes": len(routes_list),
        "routes": sorted(routes_list, key=lambda x: (x["path"], x["methods"]))
    }
    
    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

