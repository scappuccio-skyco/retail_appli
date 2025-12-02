#!/usr/bin/env python3
"""
Script pour auditer toutes les fonctionnalités de l'application Retail Performer
"""
import re
import os

def extract_features(file_path):
    """Extrait les fonctionnalités d'un fichier dashboard"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    features = {
        'modals': [],
        'handlers': [],
        'components': [],
        'routes': [],
        'buttons': []
    }
    
    # Extraire les imports de modals/components
    modal_imports = re.findall(r'import (\w+) from [\'"]\.\.\/components\/.*?Modal', content)
    component_imports = re.findall(r'import (\w+) from [\'"]\.\.\/components\/', content)
    
    features['modals'] = modal_imports
    features['components'] = list(set(component_imports) - set(modal_imports))
    
    # Extraire les handlers
    handlers = re.findall(r'const (handle\w+)\s*=', content)
    features['handlers'] = handlers
    
    # Extraire les états de modal
    modal_states = re.findall(r'const \[(show\w+Modal), set\w+Modal\]', content)
    features['modals'].extend(modal_states)
    
    # Extraire les boutons avec leur texte
    buttons = re.findall(r'<button[^>]*>(.*?)</button>', content, re.DOTALL)
    features['buttons'] = [b.strip()[:50] for b in buttons if b.strip() and len(b.strip()) < 100]
    
    return features

def analyze_dashboard(name, path):
    """Analyse un dashboard complet"""
    print(f"\n{'='*60}")
    print(f"📊 DASHBOARD: {name}")
    print(f"{'='*60}")
    
    features = extract_features(path)
    
    print(f"\n🔹 MODALS ({len(set(features['modals']))} types):")
    for modal in sorted(set(features['modals'])):
        print(f"  • {modal}")
    
    print(f"\n🔹 HANDLERS ({len(features['handlers'])} fonctions):")
    for handler in sorted(set(features['handlers']))[:15]:  # Top 15
        print(f"  • {handler}")
    if len(features['handlers']) > 15:
        print(f"  ... et {len(features['handlers']) - 15} autres")
    
    print(f"\n🔹 COMPOSANTS ({len(set(features['components']))} importés):")
    for comp in sorted(set(features['components']))[:10]:  # Top 10
        print(f"  • {comp}")
    if len(features['components']) > 10:
        print(f"  ... et {len(features['components']) - 10} autres")

# Analyser chaque dashboard
dashboards = [
    ("GÉRANT", "/app/frontend/src/pages/GerantDashboard.js"),
    ("MANAGER", "/app/frontend/src/pages/ManagerDashboard.js"),
    ("VENDEUR", "/app/frontend/src/pages/SellerDashboard.js"),
    ("IT ADMIN", "/app/frontend/src/pages/ITAdminDashboard.js"),
    ("SUPER ADMIN", "/app/frontend/src/pages/SuperAdminDashboard.js"),
]

print("🔍 AUDIT DES FONCTIONNALITÉS - RETAIL PERFORMER AI")
print("="*60)

for name, path in dashboards:
    if os.path.exists(path):
        analyze_dashboard(name, path)
    else:
        print(f"\n⚠️  {name}: Fichier non trouvé")

print("\n" + "="*60)
print("✅ Audit terminé")
