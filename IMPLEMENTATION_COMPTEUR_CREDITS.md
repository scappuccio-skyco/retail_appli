# 🛠️ GUIDE D'IMPLÉMENTATION - COMPTEUR DE CRÉDITS IA

## 🎯 Objectif

Ajouter un système de suivi et d'affichage de la consommation des crédits IA pour :
1. **Valoriser** votre offre auprès des clients
2. **Rassurer** les utilisateurs (ils voient qu'il reste beaucoup de crédits)
3. **Surveiller** l'usage et détecter les cas de surconsommation
4. **Prévoir** les futurs besoins en crédits

---

## 📊 PHASE 1 : Tracking Backend

### 1.1 Nouveau modèle MongoDB

```python
# Dans server.py - Ajoutez ce modèle Pydantic

from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional

class AIUsageLog(BaseModel):
    """Log d'utilisation de l'IA"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str  # Lié au workspace
    user_id: str  # Manager ou vendeur qui a déclenché l'action
    user_role: str  # 'manager' ou 'seller'
    feature: str  # 'debrief', 'evaluation', 'challenge', 'team_bilan', 'kpi_analysis', etc.
    model: str  # 'gpt-4o-mini' ou 'gpt-4o'
    tokens_input: int  # Tokens input
    tokens_output: int  # Tokens output
    tokens_total: int  # Total tokens
    credits_used: float  # Crédits consommés (tokens_total / 1000)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    session_id: Optional[str] = None  # Pour tracer les conversations
    
class WorkspaceAIUsage(BaseModel):
    """Résumé mensuel de l'usage IA d'un workspace"""
    workspace_id: str
    year_month: str  # Format: "2025-01"
    credits_limit: int  # 500 ou 1500 selon le plan
    credits_used: float  # Total consommé ce mois
    credits_remaining: float  # Limite - Utilisé
    usage_percentage: float  # % d'utilisation
    last_updated: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    # Détail par feature
    breakdown_by_feature: dict = {}  # {'debrief': 45.2, 'evaluation': 12.5, ...}
    breakdown_by_user: dict = {}  # {'manager_id': 100.5, 'seller1_id': 50.2, ...}
```

### 1.2 Fonction de logging

```python
# Dans server.py - Fonction utilitaire

async def log_ai_usage(
    workspace_id: str,
    user_id: str,
    user_role: str,
    feature: str,
    model: str,
    tokens_input: int,
    tokens_output: int,
    session_id: Optional[str] = None
):
    """
    Log l'utilisation de l'IA et met à jour le compteur mensuel
    """
    tokens_total = tokens_input + tokens_output
    credits_used = tokens_total / 1000  # 1 crédit = 1000 tokens
    
    # 1. Créer le log détaillé
    usage_log = AIUsageLog(
        workspace_id=workspace_id,
        user_id=user_id,
        user_role=user_role,
        feature=feature,
        model=model,
        tokens_input=tokens_input,
        tokens_output=tokens_output,
        tokens_total=tokens_total,
        credits_used=credits_used,
        session_id=session_id
    )
    
    await db.ai_usage_logs.insert_one(usage_log.dict())
    
    # 2. Mettre à jour le compteur mensuel
    now = datetime.now(timezone.utc)
    year_month = now.strftime("%Y-%m")
    
    # Récupérer le workspace pour connaître la limite
    workspace = await db.workspaces.find_one({"id": workspace_id})
    if not workspace:
        return
    
    # Déterminer la limite de crédits selon le plan
    plan = workspace.get('subscription', {}).get('plan', 'starter')
    credits_limit = 500 if plan == 'starter' else 1500
    
    # Chercher ou créer le document mensuel
    monthly_usage = await db.workspace_ai_usage.find_one({
        "workspace_id": workspace_id,
        "year_month": year_month
    })
    
    if monthly_usage:
        # Incrémenter
        new_credits_used = monthly_usage['credits_used'] + credits_used
        new_breakdown_by_feature = monthly_usage.get('breakdown_by_feature', {})
        new_breakdown_by_feature[feature] = new_breakdown_by_feature.get(feature, 0) + credits_used
        
        new_breakdown_by_user = monthly_usage.get('breakdown_by_user', {})
        new_breakdown_by_user[user_id] = new_breakdown_by_user.get(user_id, 0) + credits_used
        
        await db.workspace_ai_usage.update_one(
            {"workspace_id": workspace_id, "year_month": year_month},
            {"$set": {
                "credits_used": new_credits_used,
                "credits_remaining": credits_limit - new_credits_used,
                "usage_percentage": (new_credits_used / credits_limit) * 100,
                "breakdown_by_feature": new_breakdown_by_feature,
                "breakdown_by_user": new_breakdown_by_user,
                "last_updated": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Créer
        new_usage = WorkspaceAIUsage(
            workspace_id=workspace_id,
            year_month=year_month,
            credits_limit=credits_limit,
            credits_used=credits_used,
            credits_remaining=credits_limit - credits_used,
            usage_percentage=(credits_used / credits_limit) * 100,
            breakdown_by_feature={feature: credits_used},
            breakdown_by_user={user_id: credits_used}
        )
        await db.workspace_ai_usage.insert_one(new_usage.dict())
```

### 1.3 Intégration dans vos appels IA existants

**Exemple : Débrief de vente**

```python
# Dans generate_ai_debrief_analysis()

async def generate_ai_debrief_analysis(debrief_data: dict, seller_name: str, current_scores: dict) -> dict:
    # ... votre code existant ...
    
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=f"debrief_{uuid.uuid4()}",
            system_message="..."
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(text=prompt)
        ai_response = await chat.send_message(user_message)
        
        # 🆕 LOGGING ICI
        # Estimer les tokens (ou utiliser les valeurs réelles si l'API les retourne)
        tokens_input = len(prompt.split()) * 1.3  # Approximation
        tokens_output = len(ai_response.split()) * 1.3
        
        # Récupérer le workspace_id du vendeur
        seller = await db.users.find_one({"id": debrief_data.get('seller_id')})
        workspace_id = seller.get('workspace_id')
        
        if workspace_id:
            await log_ai_usage(
                workspace_id=workspace_id,
                user_id=debrief_data.get('seller_id'),
                user_role='seller',
                feature='debrief',
                model='gpt-4o-mini',
                tokens_input=int(tokens_input),
                tokens_output=int(tokens_output),
                session_id=f"debrief_{uuid.uuid4()}"
            )
        
        # ... reste de votre code ...
```

**Répétez pour toutes les features IA :**
- `generate_ai_feedback()` → feature='evaluation'
- `get_daily_challenge()` → feature='challenge'
- `generate_conflict_resolution_analysis()` → feature='conflict_resolution'
- `analyze_team_data()` → feature='team_bilan'
- `analyze_store_kpis()` → feature='kpi_analysis'

---

## 📱 PHASE 2 : Affichage Frontend

### 2.1 Nouvel endpoint API

```python
# Dans server.py

@api_router.get("/ai-usage/monthly")
async def get_monthly_ai_usage(current_user: dict = Depends(get_current_user)):
    """Récupère l'usage IA du mois en cours pour le workspace"""
    
    # Récupérer le workspace de l'utilisateur
    user = await db.users.find_one({"id": current_user['id']})
    workspace_id = user.get('workspace_id')
    
    if not workspace_id:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Récupérer l'usage du mois en cours
    now = datetime.now(timezone.utc)
    year_month = now.strftime("%Y-%m")
    
    monthly_usage = await db.workspace_ai_usage.find_one({
        "workspace_id": workspace_id,
        "year_month": year_month
    })
    
    if not monthly_usage:
        # Pas encore d'usage ce mois-ci
        workspace = await db.workspaces.find_one({"id": workspace_id})
        plan = workspace.get('subscription', {}).get('plan', 'starter')
        credits_limit = 500 if plan == 'starter' else 1500
        
        return {
            "year_month": year_month,
            "credits_limit": credits_limit,
            "credits_used": 0,
            "credits_remaining": credits_limit,
            "usage_percentage": 0,
            "breakdown_by_feature": {},
            "breakdown_by_user": {}
        }
    
    return monthly_usage

@api_router.get("/ai-usage/history")
async def get_ai_usage_history(
    months: int = 3,
    current_user: dict = Depends(get_current_user)
):
    """Récupère l'historique d'usage IA sur N mois"""
    
    user = await db.users.find_one({"id": current_user['id']})
    workspace_id = user.get('workspace_id')
    
    if not workspace_id:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Générer les year_month des N derniers mois
    from dateutil.relativedelta import relativedelta
    now = datetime.now(timezone.utc)
    month_list = []
    for i in range(months):
        target_date = now - relativedelta(months=i)
        month_list.append(target_date.strftime("%Y-%m"))
    
    # Récupérer les données
    history = await db.workspace_ai_usage.find({
        "workspace_id": workspace_id,
        "year_month": {"$in": month_list}
    }).sort("year_month", -1).to_list(length=months)
    
    return history
```

### 2.2 Composant React - Badge de crédits

```jsx
// Créer un nouveau fichier : frontend/src/components/AICreditsWidget.js

import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AICreditsWidget() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/ai-usage/monthly`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsage(response.data);
    } catch (error) {
      console.error('Error fetching AI usage:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !usage) {
    return null;
  }

  const percentageUsed = usage.usage_percentage || 0;
  const creditsRemaining = usage.credits_remaining || usage.credits_limit;

  // Couleurs selon l'usage
  let statusColor = 'green';
  let statusIcon = <Sparkles className="w-5 h-5" />;
  let statusText = 'Excellent';

  if (percentageUsed > 80) {
    statusColor = 'red';
    statusIcon = <AlertTriangle className="w-5 h-5" />;
    statusText = 'Attention';
  } else if (percentageUsed > 50) {
    statusColor = 'orange';
    statusIcon = <TrendingUp className="w-5 h-5" />;
    statusText = 'Bon usage';
  }

  return (
    <div className={`bg-gradient-to-r from-${statusColor}-50 to-${statusColor}-100 rounded-xl p-4 border-2 border-${statusColor}-200 shadow-md`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {statusIcon}
          <h3 className="font-bold text-gray-800">Crédits IA</h3>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold bg-${statusColor}-200 text-${statusColor}-800`}>
          {statusText}
        </span>
      </div>

      {/* Barre de progression */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">
            {Math.round(usage.credits_used)} / {usage.credits_limit} crédits
          </span>
          <span className="font-bold text-gray-800">
            {percentageUsed.toFixed(0)}%
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r from-${statusColor}-400 to-${statusColor}-600 transition-all duration-500`}
            style={{ width: `${Math.min(percentageUsed, 100)}%` }}
          />
        </div>
      </div>

      {/* Texte informatif */}
      <div className="text-sm text-gray-700">
        <p className="font-semibold">
          🎉 Il vous reste <span className="text-lg font-black">{Math.round(creditsRemaining)}</span> crédits
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Environ {Math.round(creditsRemaining / 1.2)} analyses IA disponibles
        </p>
      </div>

      {/* Alerte si > 80% */}
      {percentageUsed > 80 && (
        <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
          <strong>⚠️ Limite bientôt atteinte</strong>
          <p>Contactez-nous pour augmenter votre forfait IA.</p>
        </div>
      )}
    </div>
  );
}
```

### 2.3 Intégration dans le Dashboard Manager

```jsx
// Dans frontend/src/pages/ManagerDashboard.js

import AICreditsWidget from '../components/AICreditsWidget';

// Dans le render, ajoutez le widget en haut à droite ou dans une sidebar

<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
  {/* Colonne principale */}
  <div className="lg:col-span-3">
    {/* Votre contenu existant */}
  </div>
  
  {/* Sidebar droite */}
  <div className="space-y-6">
    <AICreditsWidget />
    {/* Autres widgets */}
  </div>
</div>
```

### 2.4 Modal détaillée (optionnel)

```jsx
// Créer frontend/src/components/AIUsageModal.js

import React, { useState, useEffect } from 'react';
import { X, BarChart3, PieChart, Users } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AIUsageModal({ isOpen, onClose }) {
  const [usage, setUsage] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [usageRes, historyRes] = await Promise.all([
        axios.get(`${API}/api/ai-usage/monthly`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/ai-usage/history?months=3`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setUsage(usageRes.data);
      setHistory(historyRes.data);
    } catch (error) {
      console.error('Error fetching AI usage data:', error);
    }
  };

  if (!isOpen || !usage) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          Détails de votre usage IA
        </h2>

        {/* Usage du mois */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl mb-6">
          <h3 className="text-xl font-bold mb-4">Ce mois-ci</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Crédits utilisés</p>
              <p className="text-3xl font-black text-blue-600">
                {Math.round(usage.credits_used)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Crédits restants</p>
              <p className="text-3xl font-black text-green-600">
                {Math.round(usage.credits_remaining)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Limite</p>
              <p className="text-3xl font-black text-gray-800">
                {usage.credits_limit}
              </p>
            </div>
          </div>
        </div>

        {/* Répartition par feature */}
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <PieChart className="w-6 h-6" />
            Répartition par fonctionnalité
          </h3>
          <div className="space-y-2">
            {Object.entries(usage.breakdown_by_feature || {}).map(([feature, credits]) => {
              const percentage = (credits / usage.credits_used) * 100;
              return (
                <div key={feature} className="flex items-center gap-3">
                  <div className="w-32 text-sm font-semibold capitalize">
                    {feature.replace('_', ' ')}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-400 to-indigo-600 flex items-center justify-end pr-2"
                        style={{ width: `${percentage}%` }}
                      >
                        <span className="text-xs font-bold text-white">
                          {Math.round(credits)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-16 text-sm text-gray-600 text-right">
                    {percentage.toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Historique */}
        <div>
          <h3 className="text-xl font-bold mb-4">Historique (3 derniers mois)</h3>
          <div className="space-y-3">
            {history.map((month) => (
              <div key={month.year_month} className="bg-gray-50 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold">{month.year_month}</p>
                  <p className="text-sm text-gray-600">
                    {Math.round(month.credits_used)} / {month.credits_limit} crédits
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-blue-600">
                    {month.usage_percentage.toFixed(0)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={onClose}
          className="mt-6 w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
```

---

## 🚀 PHASE 3 : Déploiement

### Checklist de déploiement

- [ ] **Backend**
  - [ ] Ajouter les modèles `AIUsageLog` et `WorkspaceAIUsage`
  - [ ] Créer la fonction `log_ai_usage()`
  - [ ] Intégrer les logs dans tous les appels IA
  - [ ] Créer les endpoints `/api/ai-usage/monthly` et `/api/ai-usage/history`
  - [ ] Tester avec Postman/curl

- [ ] **Frontend**
  - [ ] Créer `AICreditsWidget.js`
  - [ ] Créer `AIUsageModal.js` (optionnel)
  - [ ] Intégrer dans `ManagerDashboard.js`
  - [ ] Tester visuellement

- [ ] **MongoDB**
  - [ ] Créer les collections `ai_usage_logs` et `workspace_ai_usage`
  - [ ] Ajouter des index pour performances :
    ```javascript
    db.ai_usage_logs.createIndex({ workspace_id: 1, timestamp: -1 })
    db.workspace_ai_usage.createIndex({ workspace_id: 1, year_month: -1 }, { unique: true })
    ```

- [ ] **Testing**
  - [ ] Créer quelques débriefs / évaluations
  - [ ] Vérifier que les logs apparaissent dans MongoDB
  - [ ] Vérifier que le widget affiche les bonnes valeurs
  - [ ] Tester l'historique sur 3 mois

---

## 📈 Bénéfices attendus

1. **Pour vous :**
   - Visibilité sur la consommation réelle
   - Détection anticipée des surconsommations
   - Données pour optimiser l'offre

2. **Pour vos clients :**
   - Transparence totale
   - Valorisation de l'offre ("regardez tout ce que vous utilisez !")
   - Rassurance ("il me reste encore 400 crédits")

3. **Marketing :**
   - Arguments de vente plus forts
   - Preuves d'utilisation pour témoignages
   - Base pour upsell vers plan supérieur

---

## 🎬 Prochaines étapes

Après implémentation du compteur :

1. **Semaine 1-2** : Observer l'usage réel
2. **Mois 1** : Collecter des données
3. **Mois 2** : Analyser et ajuster l'offre si besoin
4. **Mois 3** : Décider d'augmenter les forfaits ou passer en "illimité"

---

*Guide d'implémentation - Janvier 2025*
