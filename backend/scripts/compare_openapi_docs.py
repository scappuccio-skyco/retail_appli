#!/usr/bin/env python3
"""
Compare OpenAPI schema (runtime vs repo) and generate docs_openapi_gap.md
"""
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set, Tuple
import urllib.request
import urllib.error

def load_json_file(file_path: Path) -> dict:
    """Load JSON file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as e:
        print(f"Error parsing {file_path}: {e}", file=sys.stderr)
        return {}

def fetch_openapi_runtime(base_url: str = "https://api.retailperformerai.com") -> dict:
    """Fetch OpenAPI schema from runtime API"""
    try:
        url = f"{base_url}/openapi.json"
        print(f"Fetching OpenAPI from {url}...", file=sys.stderr)
        with urllib.request.urlopen(url, timeout=10) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.URLError as e:
        print(f"Warning: Could not fetch OpenAPI from runtime: {e}", file=sys.stderr)
        return {}
    except Exception as e:
        print(f"Error fetching OpenAPI: {e}", file=sys.stderr)
        return {}

def extract_paths_from_openapi(openapi_schema: dict) -> Dict[Tuple[str, str], dict]:
    """Extract paths from OpenAPI schema"""
    paths_dict = {}
    paths = openapi_schema.get("paths", {})
    
    for path, methods in paths.items():
        for method, details in methods.items():
            if method.upper() in ["HEAD", "OPTIONS"]:
                continue
            
            key = (path, method.upper())
            paths_dict[key] = {
                "path": path,
                "method": method.upper(),
                "operationId": details.get("operationId"),
                "summary": details.get("summary"),
                "tags": details.get("tags", []),
                "deprecated": details.get("deprecated", False),
                "description": details.get("description", ""),
            }
    
    return paths_dict

def extract_paths_from_routes_json(routes_data: dict) -> Dict[Tuple[str, str], dict]:
    """Extract paths from routes JSON"""
    paths_dict = {}
    
    for route in routes_data.get("routes", []):
        path = route.get("path", "")
        method = route.get("method", "")
        
        if isinstance(method, list):
            for m in method:
                key = (path, m.upper())
                paths_dict[key] = route.copy()
                paths_dict[key]["method"] = m.upper()
        else:
            key = (path, method.upper())
            paths_dict[key] = route
    
    return paths_dict

def compare_openapi_paths(runtime_paths: Dict, repo_paths: Dict, routes_paths: Dict) -> dict:
    """Compare OpenAPI paths"""
    runtime_keys = set(runtime_paths.keys())
    repo_keys = set(repo_paths.keys())
    routes_keys = set(routes_paths.keys())
    
    # Paths in runtime but not in repo
    only_runtime = runtime_keys - repo_keys
    
    # Paths in repo but not in runtime
    only_repo = repo_keys - runtime_keys
    
    # Paths in runtime but not in routes
    only_runtime_not_routes = runtime_keys - routes_keys
    
    # Paths in routes but not in runtime OpenAPI
    only_routes_not_runtime = routes_keys - runtime_keys
    
    # Check for deprecated paths
    deprecated_in_runtime = [
        (path, method) for (path, method), details in runtime_paths.items()
        if details.get("deprecated", False)
    ]
    
    # Check for /api/integrations/* paths (should be deprecated)
    integrations_paths = [
        (path, method) for (path, method) in runtime_keys
        if path.startswith("/api/integrations/")
    ]
    
    return {
        "only_runtime": [{"path": k[0], "method": k[1], **runtime_paths[k]} for k in only_runtime],
        "only_repo": [{"path": k[0], "method": k[1], **repo_paths[k]} for k in only_repo],
        "only_runtime_not_routes": [{"path": k[0], "method": k[1], **runtime_paths[k]} for k in only_runtime_not_routes],
        "only_routes_not_runtime": [{"path": k[0], "method": k[1], **routes_paths[k]} for k in only_routes_not_runtime],
        "deprecated_in_runtime": deprecated_in_runtime,
        "integrations_paths": integrations_paths,
        "total_runtime": len(runtime_keys),
        "total_repo": len(repo_keys),
        "total_routes": len(routes_keys),
        "common": len(runtime_keys & repo_keys)
    }

def generate_docs_gap_report(comparison: dict) -> str:
    """Generate documentation gap report"""
    lines = []
    lines.append("# Rapport d'Écart Documentation/OpenAPI")
    lines.append("")
    lines.append(f"**Généré le**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    lines.append("## Résumé")
    lines.append("")
    lines.append(f"- Routes au runtime (OpenAPI): **{comparison['total_runtime']} routes**")
    lines.append(f"- Routes dans le repo (OpenAPI): **{comparison['total_repo']} routes**")
    lines.append(f"- Routes communes: **{comparison['common']} routes**")
    lines.append(f"- Routes runtime non documentées: **{len(comparison['only_runtime'])} routes**")
    lines.append(f"- Routes documentées mais absentes du runtime: **{len(comparison['only_repo'])} routes**")
    lines.append("")
    
    # Routes runtime non documentées
    if comparison['only_runtime']:
        lines.append("## ⚠️ Routes Présentes au Runtime mais Absentes de la Doc/OpenAPI Repo")
        lines.append("")
        lines.append("| Method | Path | Summary | Tags |")
        lines.append("|--------|------|---------|------|")
        for route in sorted(comparison['only_runtime'], key=lambda x: (x['path'], x['method'])):
            path = route['path']
            method = route['method']
            summary = route.get('summary', '')[:50]
            tags = ', '.join(route.get('tags', []))
            lines.append(f"| {method} | `{path}` | {summary} | {tags} |")
        lines.append("")
    
    # Routes documentées mais absentes du runtime
    if comparison['only_repo']:
        lines.append("## ⚠️ Routes Documentées mais Absentes du Runtime")
        lines.append("")
        lines.append("| Method | Path | Summary |")
        lines.append("|--------|------|---------|")
        for route in sorted(comparison['only_repo'], key=lambda x: (x['path'], x['method'])):
            path = route['path']
            method = route['method']
            summary = route.get('summary', '')[:50]
            lines.append(f"| {method} | `{path}` | {summary} |")
        lines.append("")
    
    # Routes dépréciées
    if comparison['deprecated_in_runtime']:
        lines.append("## 🔄 Routes Dépréciées au Runtime")
        lines.append("")
        lines.append("| Method | Path |")
        lines.append("|--------|------|")
        for path, method in sorted(comparison['deprecated_in_runtime']):
            lines.append(f"| {method} | `{path}` |")
        lines.append("")
    
    # Routes /api/integrations/*
    if comparison['integrations_paths']:
        lines.append("## 🔄 Routes /api/integrations/* (À Déprécier)")
        lines.append("")
        lines.append("Ces routes doivent être marquées comme `deprecated: true` dans OpenAPI ou remplacées par les routes canoniques.")
        lines.append("")
        lines.append("| Method | Path | Action Recommandée |")
        lines.append("|--------|------|-------------------|")
        for path, method in sorted(comparison['integrations_paths']):
            # Suggérer la route canonique
            if path == "/api/integrations/kpi/sync":
                action = "Conserver avec `deprecated: true` (alias pour /api/enterprise/stores/bulk-import si applicable)"
            elif path.startswith("/api/integrations/api-keys"):
                action = "Conserver avec `deprecated: true` (utilisé pour API Key auth)"
            else:
                action = "Marquer `deprecated: true` ou supprimer"
            lines.append(f"| {method} | `{path}` | {action} |")
        lines.append("")
    
    # Problèmes de trailing slash
    lines.append("## ⚠️ Problèmes de Trailing Slash")
    lines.append("")
    lines.append("Vérifier la cohérence des trailing slashes selon la convention:")
    lines.append("- `POST /api/stores/` (avec slash pour création)")
    lines.append("- `GET /api/stores/my-stores` (sans slash pour ressources)")
    lines.append("")
    
    # Recommandations
    lines.append("## 📋 Recommandations")
    lines.append("")
    lines.append("1. **Mettre à jour OpenAPI repo** avec les routes runtime manquantes")
    lines.append("2. **Marquer `/api/integrations/*` comme `deprecated: true`** dans OpenAPI")
    lines.append("3. **Mettre `servers.url = https://api.retailperformerai.com`** dans OpenAPI")
    lines.append("4. **Vérifier la cohérence des trailing slashes**")
    lines.append("5. **Mettre à jour la documentation** (README, guides) avec les routes actuelles")
    lines.append("")
    
    return "\n".join(lines)

def main():
    root_dir = Path(__file__).parent.parent.parent
    
    # Try to fetch OpenAPI from runtime
    print("Fetching OpenAPI from runtime...", file=sys.stderr)
    runtime_openapi = fetch_openapi_runtime()
    
    # Load repo OpenAPI if exists
    repo_openapi_file = root_dir / "openapi.json"
    if not repo_openapi_file.exists():
        repo_openapi_file = root_dir / "openapi.yml"
    
    repo_openapi = {}
    if repo_openapi_file.exists():
        print(f"Loading OpenAPI from repo: {repo_openapi_file}", file=sys.stderr)
        repo_openapi = load_json_file(repo_openapi_file)
    
    # Load routes.runtime.json
    routes_runtime_file = root_dir / "routes.runtime.json"
    routes_runtime_data = {}
    if routes_runtime_file.exists():
        print(f"Loading routes from: {routes_runtime_file}", file=sys.stderr)
        routes_runtime_data = load_json_file(routes_runtime_file)
    
    # Extract paths
    runtime_paths = extract_paths_from_openapi(runtime_openapi) if runtime_openapi else {}
    repo_paths = extract_paths_from_openapi(repo_openapi) if repo_openapi else {}
    routes_paths = extract_paths_from_routes_json(routes_runtime_data) if routes_runtime_data else {}
    
    print(f"Runtime OpenAPI paths: {len(runtime_paths)}", file=sys.stderr)
    print(f"Repo OpenAPI paths: {len(repo_paths)}", file=sys.stderr)
    print(f"Routes paths: {len(routes_paths)}", file=sys.stderr)
    
    # Compare
    comparison = compare_openapi_paths(runtime_paths, repo_paths, routes_paths)
    
    # Generate report
    report = generate_docs_gap_report(comparison)
    
    # Write report
    output_file = root_dir / "docs_openapi_gap.md"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"Report generated: {output_file}", file=sys.stderr)

if __name__ == "__main__":
    main()

