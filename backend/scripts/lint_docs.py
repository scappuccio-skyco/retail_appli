#!/usr/bin/env python3
"""
Lint documentation files to ensure all mentioned endpoints exist in routes.runtime.json
Fails if documentation mentions an endpoint that doesn't exist in runtime.
"""
import json
import sys
import re
from pathlib import Path
from typing import Set, List, Tuple

def load_runtime_routes(runtime_file: Path) -> Set[Tuple[str, str]]:
    """Load routes from routes.runtime.json and return set of (path, method) tuples"""
    try:
        with open(runtime_file, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        
        routes = set()
        for route in data.get("routes", []):
            path = route.get("path", "")
            method = route.get("method", "").upper()
            if path.startswith("/api/"):
                routes.add((path, method))
        
        return routes
    except FileNotFoundError:
        print(f"Error: {runtime_file} not found", file=sys.stderr)
        return set()
    except json.JSONDecodeError as e:
        print(f"Error parsing {runtime_file}: {e}", file=sys.stderr)
        return set()

def find_api_endpoints_in_text(text: str) -> List[Tuple[str, str]]:
    """Find all API endpoints mentioned in text (pattern: /api/...)"""
    # Pattern to match /api/... endpoints
    pattern = r'/api/[a-zA-Z0-9\-_/{}]+'
    matches = re.findall(pattern, text)
    
    endpoints = []
    for match in matches:
        # Clean up the match (remove trailing punctuation, etc.)
        path = match.rstrip('.,;:!?)\'"')
        
        # Try to extract method from context (GET, POST, etc.)
        # Look for method before the path
        method_pattern = r'(GET|POST|PUT|DELETE|PATCH)\s+' + re.escape(path)
        method_match = re.search(method_pattern, text, re.IGNORECASE)
        method = method_match.group(1).upper() if method_match else None
        
        # If no method found, try to find it after the path
        if not method:
            method_pattern = re.escape(path) + r'\s+[—–-]\s*(GET|POST|PUT|DELETE|PATCH)'
            method_match = re.search(method_pattern, text, re.IGNORECASE)
            method = method_match.group(1).upper() if method_match else None
        
        # If still no method, check for common patterns
        if not method:
            # Check if it's in a code block with method
            context_pattern = r'(GET|POST|PUT|DELETE|PATCH)\s+' + re.escape(path)
            context_match = re.search(context_pattern, text, re.IGNORECASE)
            method = context_match.group(1).upper() if context_match else "ANY"
        
        endpoints.append((path, method))
    
    return endpoints

def check_documentation_file(doc_file: Path, runtime_routes: Set[Tuple[str, str]]) -> List[Tuple[str, str, str]]:
    """Check a documentation file for endpoints that don't exist in runtime"""
    try:
        content = doc_file.read_text(encoding='utf-8')
    except Exception as e:
        print(f"Error reading {doc_file}: {e}", file=sys.stderr)
        return []
    
    mentioned_endpoints = find_api_endpoints_in_text(content)
    missing_endpoints = []
    
    for path, method in mentioned_endpoints:
        # Normalize path (remove trailing slash except for root)
        normalized_path = path.rstrip('/') if path != "/" else path
        
        # Check if endpoint exists in runtime
        found = False
        for runtime_path, runtime_method in runtime_routes:
            runtime_path_normalized = runtime_path.rstrip('/') if runtime_path != "/" else runtime_path
            
            # Match path (handle path parameters)
            path_match = False
            if normalized_path == runtime_path_normalized:
                path_match = True
            else:
                # Try to match with path parameters
                # Convert {param} to regex pattern
                runtime_pattern = re.escape(runtime_path_normalized).replace(r'\{[^}]+\}', r'[^/]+')
                # Also handle {store_id} vs store-123 patterns
                if re.match(runtime_pattern + r'$', normalized_path):
                    path_match = True
                # Also try reverse: check if doc path matches runtime pattern
                doc_pattern = re.escape(normalized_path).replace(r'\{[^}]+\}', r'[^/]+')
                if re.match(doc_pattern + r'$', runtime_path_normalized):
                    path_match = True
            
            if path_match:
                # Check method
                if method == "ANY" or method == runtime_method:
                    found = True
                    break
        
        if not found:
            missing_endpoints.append((path, method, str(doc_file)))
    
    return missing_endpoints

def main():
    root_dir = Path(__file__).parent.parent.parent
    runtime_file = root_dir / "routes.runtime.json"
    
    # Load runtime routes
    print("Loading runtime routes...", file=sys.stderr)
    runtime_routes = load_runtime_routes(runtime_file)
    print(f"Found {len(runtime_routes)} routes in runtime", file=sys.stderr)
    
    # Find all documentation files
    doc_files = [
        root_dir / "API_INTEGRATION_GUIDE.md",
        root_dir / "API_README.md",
        root_dir / "API_EXAMPLES.md",
        root_dir / "GUIDE_API_STORES.md",
        root_dir / "GUIDE_API_MANAGER.md",
        root_dir / "GUIDE_API_SELLER.md",
        root_dir / "API_DOCUMENTATION.md",
        root_dir / "ENTERPRISE_API_DOCUMENTATION.md",
    ]
    
    all_missing = []
    
    for doc_file in doc_files:
        if not doc_file.exists():
            continue
        
        print(f"Checking {doc_file.name}...", file=sys.stderr)
        missing = check_documentation_file(doc_file, runtime_routes)
        all_missing.extend(missing)
    
    # Report results
    if all_missing:
        print("\n❌ ERRORS FOUND: Documentation mentions endpoints that don't exist in runtime\n", file=sys.stderr)
        print("Missing endpoints:", file=sys.stderr)
        for path, method, file_path in all_missing:
            print(f"  - {method} {path} (mentioned in {Path(file_path).name})", file=sys.stderr)
        print(f"\nTotal: {len(all_missing)} endpoint(s) missing", file=sys.stderr)
        sys.exit(1)
    else:
        print("\n✅ All endpoints in documentation exist in runtime", file=sys.stderr)
        sys.exit(0)

if __name__ == "__main__":
    main()

