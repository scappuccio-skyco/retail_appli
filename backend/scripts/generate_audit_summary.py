#!/usr/bin/env python3
"""
Generate final audit summary table
"""
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List

def load_json_file(file_path: Path) -> dict:
    """Load JSON file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {"routes": []}
    except json.JSONDecodeError as e:
        print(f"Error parsing {file_path}: {e}", file=sys.stderr)
        return {"routes": []}

def normalize_path(path: str) -> str:
    """Normalize path"""
    if path != "/" and path.endswith("/"):
        return path[:-1]
    return path

def main():
    root_dir = Path(__file__).parent.parent.parent
    
    # Load routes
    runtime_file = root_dir / "routes.runtime.json"
    code_file = root_dir / "routes.code.json"
    
    runtime_data = load_json_file(runtime_file)
    code_data = load_json_file(code_file)
    
    # Expected routes
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
    
    # Create lookup dicts
    runtime_routes = {}
    for route in runtime_data.get("routes", []):
        path = normalize_path(route.get("path", ""))
        method = route.get("method", "").upper()
        if isinstance(method, list):
            for m in method:
                runtime_routes[(path, m.upper())] = route
        else:
            runtime_routes[(path, method)] = route
    
    code_routes = {}
    for route in code_data.get("routes", []):
        path = normalize_path(route.get("path", ""))
        method = route.get("method", "").upper()
        if isinstance(method, list):
            for m in method:
                code_routes[(path, m.upper())] = route
        else:
            code_routes[(path, method)] = route
    
    # Generate summary
    lines = []
    lines.append("# Résumé Final de l'Audit des Routes API")
    lines.append("")
    lines.append(f"**Généré le**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    lines.append("## Routes Clés - Statut")
    lines.append("")
    lines.append("| Route | Method | Status Doc/OpenAPI | Status Code |")
    lines.append("|-------|--------|-------------------|-------------|")
    
    for method, path in expected_routes:
        norm_path = normalize_path(path)
        key = (norm_path, method)
        
        in_runtime = key in runtime_routes
        in_code = key in code_routes
        
        if in_runtime and in_code:
            code_status = "✅ OK"
        elif in_code:
            code_status = "⚠️ Code seulement"
        else:
            code_status = "❌ Manquant"
        
        # Check if deprecated
        deprecated = False
        if in_runtime:
            route = runtime_routes[key]
            deprecated = route.get("deprecated", False)
        
        if deprecated:
            doc_status = "🔄 Deprecated"
        elif in_runtime:
            doc_status = "✅ Documenté"
        else:
            doc_status = "❌ Non documenté"
        
        lines.append(f"| `{path}` | {method} | {doc_status} | {code_status} |")
    
    lines.append("")
    lines.append("## Légende")
    lines.append("")
    lines.append("- ✅ OK: Route présente et fonctionnelle")
    lines.append("- ⚠️ Code seulement: Route dans le code mais pas au runtime")
    lines.append("- ❌ Manquant: Route absente")
    lines.append("- 🔄 Deprecated: Route dépréciée mais conservée pour compatibilité")
    lines.append("")
    
    # Statistics
    total_runtime = len(runtime_routes)
    total_code = len(code_routes)
    common = len(set(runtime_routes.keys()) & set(code_routes.keys()))
    
    lines.append("## Statistiques")
    lines.append("")
    lines.append(f"- Total routes runtime: **{total_runtime}**")
    lines.append(f"- Total routes code: **{total_code}**")
    lines.append(f"- Routes communes: **{common}**")
    lines.append("")
    
    # Output
    summary = "\n".join(lines)
    print(summary)
    
    # Also save to file
    output_file = root_dir / "AUDIT_ROUTES_SUMMARY.md"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(summary)
    
    print(f"\nSummary saved to: {output_file}", file=sys.stderr)

if __name__ == "__main__":
    main()

