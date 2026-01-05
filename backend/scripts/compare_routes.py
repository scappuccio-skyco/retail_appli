#!/usr/bin/env python3
"""
Compare routes.runtime.json vs routes.code.json and generate routes.diff.md
"""
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set, Tuple

def load_json_file(file_path: Path) -> dict:
    """Load JSON file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Warning: {file_path} not found", file=sys.stderr)
        return {"routes": []}
    except json.JSONDecodeError as e:
        print(f"Error parsing {file_path}: {e}", file=sys.stderr)
        return {"routes": []}

def normalize_path(path: str) -> str:
    """Normalize path for comparison (handle trailing slashes)"""
    # Remove trailing slash except for root
    if path != "/" and path.endswith("/"):
        return path[:-1]
    return path

def normalize_method(method: str) -> str:
    """Normalize HTTP method"""
    return method.upper()

def create_route_key(path: str, method: str) -> Tuple[str, str]:
    """Create a unique key for a route"""
    return (normalize_path(path), normalize_method(method))

def extract_routes(data: dict) -> Dict[Tuple[str, str], dict]:
    """Extract routes from JSON data into a dict keyed by (path, method)"""
    routes = {}
    
    for route in data.get("routes", []):
        # Handle different formats
        if isinstance(route, dict):
            path = route.get("path", "")
            method = route.get("method", "")
            
            # Handle routes.code.json format (methods as list)
            if isinstance(method, list):
                for m in method:
                    key = create_route_key(path, m)
                    routes[key] = route.copy()
                    routes[key]["method"] = m
            else:
                key = create_route_key(path, method)
                routes[key] = route
    
    return routes

def compare_routes(runtime_routes: Dict, code_routes: Dict) -> dict:
    """Compare runtime vs code routes"""
    runtime_keys = set(runtime_routes.keys())
    code_keys = set(code_routes.keys())
    
    # Routes in runtime but not in code
    only_runtime = runtime_keys - code_keys
    
    # Routes in code but not in runtime
    only_code = code_keys - runtime_keys
    
    # Routes in both but with differences
    common_keys = runtime_keys & code_keys
    differences = []
    
    for key in common_keys:
        runtime_route = runtime_routes[key]
        code_route = code_routes[key]
        
        # Check for differences
        diff_items = []
        
        # Compare tags
        runtime_tags = set(runtime_route.get("tags", []))
        code_tags = set(code_route.get("tags", []))
        if runtime_tags != code_tags:
            diff_items.append(f"tags: runtime={runtime_tags}, code={code_tags}")
        
        # Compare deprecated status
        runtime_deprecated = runtime_route.get("deprecated", False)
        code_deprecated = code_route.get("deprecated", False)
        if runtime_deprecated != code_deprecated:
            diff_items.append(f"deprecated: runtime={runtime_deprecated}, code={code_deprecated}")
        
        if diff_items:
            differences.append({
                "path": key[0],
                "method": key[1],
                "differences": diff_items
            })
    
    return {
        "only_runtime": [{"path": k[0], "method": k[1], **runtime_routes[k]} for k in only_runtime],
        "only_code": [{"path": k[0], "method": k[1], **code_routes[k]} for k in only_code],
        "differences": differences,
        "common": len(common_keys),
        "total_runtime": len(runtime_keys),
        "total_code": len(code_keys)
    }

def generate_markdown_report(comparison: dict, runtime_file: Path, code_file: Path) -> str:
    """Generate markdown report"""
    lines = []
    lines.append("# Comparaison des Routes API - Runtime vs Code")
    lines.append("")
    lines.append(f"**Généré le**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    lines.append("## Résumé")
    lines.append("")
    lines.append(f"- Routes au runtime: **{comparison['total_runtime']} routes**")
    lines.append(f"- Routes dans le code: **{comparison['total_code']} routes**")
    lines.append(f"- Routes communes: **{comparison['common']} routes**")
    lines.append(f"- Routes uniquement au runtime: **{len(comparison['only_runtime'])} routes**")
    lines.append(f"- Routes uniquement dans le code: **{len(comparison['only_code'])} routes**")
    lines.append(f"- Routes avec différences: **{len(comparison['differences'])} routes**")
    lines.append("")
    
    # Routes uniquement au runtime
    if comparison['only_runtime']:
        lines.append("## ⚠️ Routes Présentes au Runtime mais Absentes du Code")
        lines.append("")
        lines.append("| Method | Path | Name | Tags |")
        lines.append("|--------|------|------|------|")
        for route in sorted(comparison['only_runtime'], key=lambda x: (x['path'], x['method'])):
            path = route['path']
            method = route['method']
            name = route.get('name', '')
            tags = ', '.join(route.get('tags', []))
            lines.append(f"| {method} | `{path}` | {name} | {tags} |")
        lines.append("")
    
    # Routes uniquement dans le code
    if comparison['only_code']:
        lines.append("## ⚠️ Routes Présentes dans le Code mais Absentes au Runtime")
        lines.append("")
        lines.append("| Method | Path | File |")
        lines.append("|--------|------|------|")
        for route in sorted(comparison['only_code'], key=lambda x: (x['path'], x['method'])):
            path = route['path']
            method = route['method']
            file = route.get('file', '')
            lines.append(f"| {method} | `{path}` | {file} |")
        lines.append("")
    
    # Routes avec différences
    if comparison['differences']:
        lines.append("## ⚠️ Routes avec Différences")
        lines.append("")
        lines.append("| Method | Path | Différences |")
        lines.append("|--------|------|-------------|")
        for diff in sorted(comparison['differences'], key=lambda x: (x['path'], x['method'])):
            path = diff['path']
            method = diff['method']
            diff_str = '; '.join(diff['differences'])
            lines.append(f"| {method} | `{path}` | {diff_str} |")
        lines.append("")
    
    # Routes clés attendues
    lines.append("## Routes Clés Attendues (Stores/Manager/Seller)")
    lines.append("")
    expected_routes = [
        ("POST", "/api/stores/"),
        ("GET", "/api/stores/my-stores"),
        ("GET", "/api/stores/{store_id}/info"),
        ("GET", "/api/manager/subscription-status"),
        ("GET", "/api/manager/store-kpi-overview"),
        ("GET", "/api/manager/dates-with-data"),
        ("GET", "/api/manager/available-years"),
        ("GET", "/api/seller/subscription-status"),
        ("GET", "/api/seller/kpi-enabled"),
        ("GET", "/api/seller/tasks"),
        ("GET", "/api/seller/objectives/active"),
        ("GET", "/api/seller/objectives/all"),
    ]
    
    lines.append("| Method | Path | Dans Runtime | Dans Code | Status |")
    lines.append("|--------|------|--------------|-----------|--------|")
    
    for method, path in expected_routes:
        runtime_key = create_route_key(path, method)
        code_key = create_route_key(path, method)
        
        in_runtime = runtime_key in comparison.get('_runtime_keys', set())
        in_code = code_key in comparison.get('_code_keys', set())
        
        if in_runtime and in_code:
            status = "✅ OK"
        elif in_runtime:
            status = "⚠️ Runtime seulement"
        elif in_code:
            status = "⚠️ Code seulement"
        else:
            status = "❌ Manquant"
        
        lines.append(f"| {method} | `{path}` | {'✅' if in_runtime else '❌'} | {'✅' if in_code else '❌'} | {status} |")
    
    lines.append("")
    
    return "\n".join(lines)

def main():
    root_dir = Path(__file__).parent.parent.parent
    runtime_file = root_dir / "routes.runtime.json"
    code_file = root_dir / "routes.code.json"
    output_file = root_dir / "routes.diff.md"
    
    # Load routes
    print(f"Loading {runtime_file}...", file=sys.stderr)
    runtime_data = load_json_file(runtime_file)
    
    print(f"Loading {code_file}...", file=sys.stderr)
    code_data = load_json_file(code_file)
    
    # Extract routes
    runtime_routes = extract_routes(runtime_data)
    code_routes = extract_routes(code_data)
    
    print(f"Runtime routes: {len(runtime_routes)}", file=sys.stderr)
    print(f"Code routes: {len(code_routes)}", file=sys.stderr)
    
    # Compare
    comparison = compare_routes(runtime_routes, code_routes)
    comparison['_runtime_keys'] = set(runtime_routes.keys())
    comparison['_code_keys'] = set(code_routes.keys())
    
    # Generate report
    report = generate_markdown_report(comparison, runtime_file, code_file)
    
    # Write report
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"Report generated: {output_file}", file=sys.stderr)
    print(f"Summary:", file=sys.stderr)
    print(f"  - Common: {comparison['common']}", file=sys.stderr)
    print(f"  - Only runtime: {len(comparison['only_runtime'])}", file=sys.stderr)
    print(f"  - Only code: {len(comparison['only_code'])}", file=sys.stderr)
    print(f"  - Differences: {len(comparison['differences'])}", file=sys.stderr)

if __name__ == "__main__":
    main()

