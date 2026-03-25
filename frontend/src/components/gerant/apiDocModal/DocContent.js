import React from 'react';
import { ExternalLink } from 'lucide-react';

export default function DocContent({ onContactSupport }) {
  return (
    <div className="prose prose-slate max-w-none">

      {/* Vue d'ensemble */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">📋 À quoi sert l'API Intégrations ?</h3>
        <p className="text-gray-700 mb-4">
          L'API Intégrations permet à vos logiciels externes (caisse, ERP, systèmes de paie) de <strong>gérer automatiquement</strong> vos magasins, équipes et données de vente avec Retail Performer AI.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <p className="text-blue-900 font-semibold mb-2">💡 Exemples d'utilisation :</p>
          <ul className="text-blue-800 space-y-2 ml-4">
            <li>• <strong>Créer des magasins automatiquement</strong> → Votre ERP crée un nouveau magasin dans Retail Performer AI</li>
            <li>• <strong>Gérer votre équipe</strong> → Créez des managers et vendeurs depuis votre système RH</li>
            <li>• <strong>Synchroniser les ventes</strong> → Votre caisse enregistre les ventes et les KPI sont automatiquement envoyés</li>
            <li>• <strong>Mettre à jour les informations</strong> → Modifiez les noms, téléphones, statuts des utilisateurs</li>
            <li>• <strong>Plus besoin de saisie manuelle</strong> → Tout est automatisé</li>
          </ul>
        </div>
      </section>

      {/* Gestion des clés */}
      <section className="mb-8 bg-purple-50 p-6 rounded-lg border border-purple-200">
        <h3 className="text-xl font-bold text-purple-900 mb-4">🔑 Comment créer une clé API ?</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Étape 1 : Créer une clé API</h4>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
              <li>Dans l'interface gérant, cliquez sur <strong>"Créer une nouvelle clé API"</strong></li>
              <li>Remplissez le formulaire :
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                  <li><strong>Nom</strong> : Donnez un nom à votre clé (ex: "Caisse Magasin Paris")</li>
                  <li><strong>Permissions</strong> : Cochez les permissions nécessaires :
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                      <li><code className="bg-purple-200 px-1 rounded text-xs">write:kpi</code> - Synchroniser les KPI (usage le plus courant)</li>
                      <li><code className="bg-purple-200 px-1 rounded text-xs">stores:read</code> - Lire les magasins et leur équipe</li>
                      <li><code className="bg-purple-200 px-1 rounded text-xs">stores:write</code> - Créer/supprimer des magasins</li>
                      <li><code className="bg-purple-200 px-1 rounded text-xs">users:write</code> - Créer/modifier/supprimer managers et vendeurs</li>
                      <li><code className="bg-purple-200 px-1 rounded text-xs">read:stats</code> - Lire les statistiques (usage futur)</li>
                    </ul>
                  </li>
                  <li><strong>Expiration</strong> : Optionnel - définissez une date d'expiration pour plus de sécurité</li>
                </ul>
              </li>
              <li>Cliquez sur <strong>"Créer la clé"</strong></li>
              <li className="text-red-600 font-semibold">⚠️ IMPORTANT : Copiez immédiatement la clé générée - elle ne sera plus affichée après</li>
            </ol>
          </div>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
            <p className="text-yellow-900 text-sm">
              <strong>💡 Conseil :</strong> Donnez un nom clair à votre clé (ex: "Caisse Magasin Paris") pour savoir facilement quelle clé utilise quel système.
            </p>
          </div>
        </div>
      </section>

      {/* Authentification */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">🔐 Comment s'authentifier ?</h3>
        <p className="text-gray-700 mb-4">Pour utiliser l'API, vous devez inclure votre clé API dans chaque requête. Il y a deux façons de faire :</p>
        <div className="space-y-4">
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
            <div className="text-gray-400 mb-2">Méthode 1 (recommandée) :</div>
            <code className="text-yellow-300">X-API-Key: sk_live_votre_cle_api_ici</code>
          </div>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
            <div className="text-gray-400 mb-2">Méthode 2 (alternative) :</div>
            <code className="text-yellow-300">Authorization: Bearer sk_live_votre_cle_api_ici</code>
          </div>
        </div>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mt-4 rounded">
          <p className="text-blue-900 text-sm">
            <strong>Note :</strong> Cette clé API est différente de votre mot de passe. Elle sert uniquement pour les intégrations automatiques avec vos logiciels externes.
          </p>
        </div>
      </section>

      {/* KPI Sync */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Synchroniser les KPI (Chiffres de vente)</h3>
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4 rounded">
          <p className="text-green-900 font-semibold mb-2">✅ Endpoint disponible : POST /api/integrations/kpi/sync</p>
          <p className="text-green-800 text-sm">Cet endpoint permet d'envoyer les données de vente (CA, nombre de ventes, articles vendus) depuis votre caisse ou ERP vers Retail Performer AI.</p>
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">📍 Adresse de l'API</h4>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
              <code className="text-blue-300">https://api.retailperformerai.com/api/integrations/kpi/sync</code>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">📝 Que pouvez-vous envoyer ?</h4>
            <p className="text-gray-700 mb-3">Vous pouvez envoyer les données de vente pour un ou plusieurs vendeurs en une seule fois (maximum 100 vendeurs par requête).</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`{
  "store_id": "id-du-magasin",
  "date": "2026-01-15",
  "kpi_entries": [
    {
      "seller_id": "id-du-vendeur",
      "ca_journalier": 1250.50,
      "nb_ventes": 12,
      "nb_articles": 28,
      "prospects": 35
    }
  ]
}`}</pre>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">📋 Explication des champs</h4>
            <div className="bg-blue-50 p-4 rounded-lg">
              <ul className="space-y-2 text-sm">
                {[
                  ['store_id', "L'identifiant de votre magasin (vous le trouvez dans l'interface)"],
                  ['date', 'La date au format AAAA-MM-JJ (ex: 2026-01-15)'],
                  ['seller_id', "L'identifiant du vendeur (vous le trouvez dans l'interface)"],
                  ['ca_journalier', 'Le chiffre d\'affaires de la journée en euros (ex: 1250.50)'],
                  ['nb_ventes', 'Le nombre de ventes effectuées (ex: 12)'],
                  ['nb_articles', 'Le nombre d\'articles vendus (ex: 28)'],
                  ['prospects', '(Optionnel) Le nombre de clients/prospects rencontrés (ex: 35)'],
                ].map(([key, desc]) => (
                  <li key={key}>
                    <strong className="text-blue-900">{key}</strong> :
                    <span className="text-blue-800"> {desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">💡 Comment obtenir les IDs (store_id, seller_id) ?</h4>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
              <p className="text-purple-900 text-sm mb-2"><strong>Via l'API (recommandé) :</strong></p>
              <p className="text-purple-800 text-sm mb-3">Appelez d'abord <code className="bg-purple-200 px-1 rounded">GET /api/integrations/stores</code> avec votre clé API pour récupérer la liste des magasins et leurs IDs. Ensuite, pour chaque magasin, appelez <code className="bg-purple-200 px-1 rounded">GET /api/integrations/stores/{`{store_id}`}/sellers</code> pour obtenir les IDs de vos vendeurs.</p>
              <p className="text-purple-900 text-sm mb-2"><strong>Permission requise :</strong> <code className="bg-purple-200 px-1 rounded">stores:read</code></p>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">✅ Réponse de l'API</h4>
            <p className="text-gray-700 mb-2">Si tout s'est bien passé, l'API vous répond :</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs">
              <pre className="text-green-300">{`{
  "status": "success",
  "entries_created": 1,
  "entries_updated": 0,
  "total": 1
}`}</pre>
            </div>
            <p className="text-gray-600 text-sm mt-2">Cela signifie que 1 nouvelle entrée a été créée. Si vous envoyez les mêmes données le lendemain, elles seront mises à jour automatiquement.</p>
          </div>
        </div>
      </section>

      {/* Magasins */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">🏪 Gérer les magasins via l'API</h3>
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4 rounded">
          <p className="text-green-900 font-semibold mb-2">✅ Endpoints disponibles :</p>
          <ul className="text-green-800 text-sm space-y-1 ml-4">
            <li>• <code className="bg-green-200 px-1 rounded">GET /api/integrations/stores</code> - Lister vos magasins</li>
            <li>• <code className="bg-green-200 px-1 rounded">POST /api/integrations/stores</code> - Créer un nouveau magasin</li>
          </ul>
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">📋 Lister les magasins</h4>
            <p className="text-gray-700 mb-3">Récupérez la liste de tous vos magasins (ou seulement ceux autorisés si votre clé est restreinte).</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`curl -X GET "https://api.retailperformerai.com/api/integrations/stores" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici"`}</pre>
            </div>
            <p className="text-gray-600 text-sm mt-2"><strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">stores:read</code></p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">➕ Créer un magasin</h4>
            <p className="text-gray-700 mb-3">Créez un nouveau magasin depuis votre ERP ou système de gestion.</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`curl -X POST "https://api.retailperformerai.com/api/integrations/stores" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Magasin Lyon Centre",
    "location": "69001 Lyon",
    "address": "456 Rue de la République",
    "phone": "0123456789",
    "opening_hours": "Lun-Sam 10h-19h",
    "external_id": "MAG-042"
  }'`}</pre>
            </div>
            <p className="text-gray-600 text-sm mt-2"><strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">stores:write</code></p>
          </div>
        </div>
      </section>

      {/* Managers */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">👔 Gérer les managers via l'API</h3>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded">
          <p className="text-blue-900 font-semibold mb-2">✅ Endpoints disponibles :</p>
          <ul className="text-blue-800 text-sm space-y-1 ml-4">
            <li>• <code className="bg-blue-200 px-1 rounded">GET /api/integrations/stores/{`{store_id}`}/managers</code> - Lister les managers</li>
            <li>• <code className="bg-blue-200 px-1 rounded">POST /api/integrations/stores/{`{store_id}`}/managers</code> - Créer un manager</li>
          </ul>
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">📋 Lister les managers</h4>
            <p className="text-gray-700 mb-3">Récupérez la liste de tous les managers d'un magasin.</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`curl -X GET "https://api.retailperformerai.com/api/integrations/stores/store-123/managers" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici"`}</pre>
            </div>
            <p className="text-gray-600 text-sm mt-2"><strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">stores:read</code></p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs mt-3">
              <pre className="text-green-300">{`{
  "managers": [
    {
      "id": "manager-789",
      "name": "Jean Dupont",
      "email": "jean.dupont@example.com",
      "phone": "0123456789",
      "role": "manager",
      "status": "active",
      "store_id": "store-123"
    }
  ]
}`}</pre>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">➕ Créer un manager</h4>
            <p className="text-gray-700 mb-3">Créez un manager depuis votre système RH. Le manager sera automatiquement lié au magasin indiqué dans l'URL.</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`curl -X POST "https://api.retailperformerai.com/api/integrations/stores/store-123/managers" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jean Dupont",
    "email": "jean.dupont@example.com",
    "phone": "0123456789",
    "external_id": "EMP-101",
    "send_invitation": true
  }'`}</pre>
            </div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-3 rounded">
              <p className="text-yellow-900 text-sm">
                <strong>⚠️ Important :</strong> Le magasin est déterminé par l'URL (<code className="bg-yellow-200 px-1 rounded">/stores/store-123/managers</code>). Tout <code className="bg-yellow-200 px-1 rounded">store_id</code> dans le body sera ignoré.
              </p>
            </div>
            <p className="text-gray-600 text-sm mt-2"><strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">users:write</code></p>
          </div>
        </div>
      </section>

      {/* Vendeurs */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">👤 Gérer les vendeurs via l'API</h3>
        <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-4 rounded">
          <p className="text-purple-900 font-semibold mb-2">✅ Endpoints disponibles :</p>
          <ul className="text-purple-800 text-sm space-y-1 ml-4">
            <li>• <code className="bg-purple-200 px-1 rounded">GET /api/integrations/stores/{`{store_id}`}/sellers</code> - Lister les vendeurs</li>
            <li>• <code className="bg-purple-200 px-1 rounded">POST /api/integrations/stores/{`{store_id}`}/sellers</code> - Créer un vendeur</li>
          </ul>
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">📋 Lister les vendeurs</h4>
            <p className="text-gray-700 mb-3">Récupérez la liste de tous les vendeurs d'un magasin.</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`curl -X GET "https://api.retailperformerai.com/api/integrations/stores/store-123/sellers" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici"`}</pre>
            </div>
            <p className="text-gray-600 text-sm mt-2"><strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">stores:read</code></p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs mt-3">
              <pre className="text-green-300">{`{
  "sellers": [
    {
      "id": "seller-456",
      "name": "Marie Martin",
      "email": "marie.martin@example.com",
      "phone": "0123456789",
      "role": "seller",
      "status": "active",
      "store_id": "store-123",
      "manager_id": "manager-789"
    }
  ]
}`}</pre>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">➕ Créer un vendeur</h4>
            <p className="text-gray-700 mb-3">Créez un vendeur depuis votre système RH. Le vendeur sera automatiquement lié au magasin indiqué dans l'URL.</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`curl -X POST "https://api.retailperformerai.com/api/integrations/stores/store-123/sellers" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Marie Martin",
    "email": "marie.martin@example.com",
    "phone": "0123456789",
    "manager_id": "manager-789",
    "external_id": "EMP-102",
    "send_invitation": true
  }'`}</pre>
            </div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-3 rounded space-y-2">
              <p className="text-yellow-900 text-sm">
                <strong>💡 manager_id :</strong> Si non renseigné, un manager actif du magasin sera assigné automatiquement.
              </p>
              <p className="text-yellow-900 text-sm">
                <strong>💡 send_invitation :</strong> Si <code className="bg-yellow-200 px-1 rounded">true</code> (défaut), un email d'invitation est envoyé automatiquement. Mettez <code className="bg-yellow-200 px-1 rounded">false</code> pour créer le compte sans envoyer d'email.
              </p>
              <p className="text-yellow-900 text-sm">
                <strong>💡 external_id :</strong> Champ libre pour stocker l'identifiant de votre système (RH, caisse, ERP). Utile pour faire le lien entre vos systèmes et Retail Performer AI.
              </p>
            </div>
            <p className="text-gray-600 text-sm mt-2"><strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">users:write</code></p>
          </div>
        </div>
      </section>

      {/* Modifier utilisateurs */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">✏️ Modifier les utilisateurs via l'API</h3>
        <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-4 rounded">
          <p className="text-indigo-900 font-semibold mb-2">✅ Endpoint disponible : PUT /api/integrations/users/{`{user_id}`}</p>
          <p className="text-indigo-800 text-sm">Modifiez les informations d'un utilisateur (manager ou vendeur). Seuls certains champs peuvent être modifiés.</p>
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">📝 Modifier un utilisateur</h4>
            <p className="text-gray-700 mb-3">Mettez à jour le nom, téléphone, statut ou ID externe d'un utilisateur.</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`curl -X PUT "https://api.retailperformerai.com/api/integrations/users/user-123" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jean Dupont Modifié",
    "phone": "0987654321",
    "status": "active",
    "external_id": "USER-001"
  }'`}</pre>
            </div>
            <div className="bg-red-50 border-l-4 border-red-400 p-3 mt-3 rounded">
              <p className="text-red-900 text-sm">
                <strong>❌ Champs interdits :</strong> Vous ne pouvez <strong>pas</strong> modifier l'email, le tenant_id, le store_id ou le role via l'API.
              </p>
            </div>
            <div className="bg-green-50 border-l-4 border-green-400 p-3 mt-3 rounded">
              <p className="text-green-900 text-sm">
                <strong>✅ Champs autorisés :</strong> <code className="bg-green-200 px-1 rounded">name</code>, <code className="bg-green-200 px-1 rounded">phone</code>, <code className="bg-green-200 px-1 rounded">status</code> (active/suspended), <code className="bg-green-200 px-1 rounded">external_id</code>
              </p>
            </div>
            <p className="text-gray-600 text-sm mt-2"><strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">users:write</code></p>
          </div>
        </div>
      </section>

      {/* Supprimer magasin */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">🗑️ Supprimer un magasin via l'API</h3>
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded">
          <p className="text-red-900 font-semibold mb-2">✅ Endpoint disponible : DELETE /api/integrations/stores/{`{store_id}`}</p>
          <p className="text-red-800 text-sm">Supprime (désactive) un magasin. Cette opération suspend automatiquement tous les membres du personnel du magasin.</p>
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">⚠️ Suppression douce</h4>
            <p className="text-gray-700 mb-3">La suppression est une <strong>suppression douce</strong> : le magasin est marqué comme inactif, mais les données historiques sont conservées.</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`curl -X DELETE "https://api.retailperformerai.com/api/integrations/stores/store-123" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici"`}</pre>
            </div>
            <p className="text-gray-600 text-sm mt-2"><strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">stores:write</code></p>
          </div>
        </div>
      </section>

      {/* Supprimer utilisateur */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">🗑️ Supprimer un utilisateur via l'API</h3>
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded">
          <p className="text-red-900 font-semibold mb-2">✅ Endpoint disponible : DELETE /api/integrations/users/{`{user_id}`}</p>
          <p className="text-red-800 text-sm">Supprime (soft delete) un manager ou vendeur. Les données historiques sont conservées.</p>
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">⚠️ Suppression douce</h4>
            <p className="text-gray-700 mb-3">La suppression est une <strong>suppression douce</strong> : l'utilisateur est marqué comme supprimé, mais les données historiques sont conservées.</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`curl -X DELETE "https://api.retailperformerai.com/api/integrations/users/user-123" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici"`}</pre>
            </div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-3 rounded">
              <p className="text-yellow-900 text-sm">
                <strong>⚠️ Important :</strong> Vous ne pouvez <strong>pas</strong> supprimer un gérant via l'API. Seuls les managers et vendeurs peuvent être supprimés.
              </p>
            </div>
            <p className="text-gray-600 text-sm mt-2"><strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">users:write</code></p>
          </div>
        </div>
      </section>

      {/* Exemples pratiques */}
      <section className="mb-8 bg-gray-50 p-6 rounded-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">💻 Exemples pour votre développeur</h3>
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Exemple avec cURL (Bash/Linux/Mac)</h4>
            <p className="text-gray-600 text-sm mb-2">Cette commande peut être utilisée dans un script automatique qui s'exécute chaque jour :</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`curl -X POST "https://api.retailperformerai.com/api/integrations/kpi/sync" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store_id": "votre-store-id",
    "date": "2026-01-15",
    "kpi_entries": [
      {
        "seller_id": "votre-seller-id",
        "ca_journalier": 1250.50,
        "nb_ventes": 12,
        "nb_articles": 28,
        "prospects": 35
      }
    ]
  }'`}</pre>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Exemple avec Python</h4>
            <p className="text-gray-600 text-sm mb-2">Code Python que votre développeur peut intégrer dans votre système de caisse :</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`import requests
from datetime import datetime

# Votre clé API (à garder secrète)
API_KEY = "sk_live_votre_cle_api_ici"
BASE_URL = "https://api.retailperformerai.com"

# Données à envoyer
kpi_data = {
    "store_id": "votre-store-id",
    "date": datetime.now().strftime("%Y-%m-%d"),
    "kpi_entries": [
        {
            "seller_id": "votre-seller-id",
            "ca_journalier": 1250.50,
            "nb_ventes": 12,
            "nb_articles": 28,
            "prospects": 35
        }
    ]
}

# Envoyer les données
response = requests.post(
    f"{BASE_URL}/api/integrations/kpi/sync",
    headers={"X-API-Key": API_KEY},
    json=kpi_data
)

# Vérifier le résultat
if response.status_code == 200:
    print("✅ KPI synchronisés avec succès !")
    print(response.json())
else:
    print(f"❌ Erreur : {response.status_code}")
    print(response.json())`}</pre>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Exemple avec JavaScript / Node.js</h4>
            <p className="text-gray-600 text-sm mb-2">Code compatible navigateur et Node.js pour synchroniser les KPI :</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="text-green-300">{`const API_KEY = "sk_live_votre_cle_api_ici";
const BASE_URL = "https://api.retailperformerai.com";

async function syncKPI(storeId, sellerId, data) {
  const response = await fetch(\`\${BASE_URL}/api/integrations/kpi/sync\`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      store_id: storeId,
      date: new Date().toISOString().split("T")[0],
      kpi_entries: [{
        seller_id: sellerId,
        ca_journalier: data.ca,
        nb_ventes: data.ventes,
        nb_articles: data.articles,
        prospects: data.prospects ?? 0,
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(\`Erreur \${response.status}: \${err.detail}\`);
  }

  return response.json();
}

// Utilisation
syncKPI("votre-store-id", "votre-seller-id", {
  ca: 1250.50, ventes: 12, articles: 28, prospects: 35
}).then(result => console.log("✅ Synchronisé :", result));`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Problèmes fréquents */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">❓ Problèmes fréquents</h3>
        <div className="space-y-4">
          {[
            { title: '❌ Erreur 401 : Clé API invalide', text: 'Vérifiez que vous avez bien copié la clé API complète (elle commence par ', code: 'sk_live_', suffix: '). Assurez-vous qu\'il n\'y a pas d\'espaces avant ou après la clé.' },
            { title: '❌ Erreur 403 : Permissions insuffisantes', text: 'Vérifiez que votre clé API a bien la permission requise (ex: ', code: 'write:kpi', suffix: ' pour les KPI). Si ce n\'est pas le cas, créez une nouvelle clé avec cette permission.' },
            { title: '❌ Erreur 404 : Ressource introuvable', text: 'L\'identifiant utilisé (', code: 'store_id', suffix: ' ou seller_id) est incorrect ou n\'existe pas. Appelez d\'abord GET /api/integrations/stores pour récupérer les IDs valides.' },
            { title: '❌ Erreur 429 : Trop de requêtes', text: 'Vous avez dépassé la limite de 60 requêtes/minute. Attendez quelques secondes avant de réessayer. Consultez le header ', code: 'Retry-After', suffix: ' de la réponse pour savoir combien de temps attendre.' },
          ].map(({ title, text, code, suffix }) => (
            <div key={title} className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p className="text-red-900 font-semibold mb-2">{title}</p>
              <p className="text-red-800 text-sm">
                <strong>Solution :</strong> {text}<code className="bg-red-200 px-1 rounded">{code}</code>{suffix}
              </p>
            </div>
          ))}
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="text-red-900 font-semibold mb-2">❌ Erreur 400 : Données invalides</p>
            <p className="text-red-800 text-sm">
              <strong>Solution :</strong> Vérifiez que :
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>La date est au format AAAA-MM-JJ (ex: 2026-01-15)</li>
                <li>Vous n'envoyez pas plus de 100 vendeurs en une seule fois</li>
                <li>Les IDs (store_id, seller_id) sont corrects</li>
                <li>Les nombres (CA, ventes, articles) sont des nombres valides</li>
              </ul>
            </p>
          </div>
        </div>
      </section>

      {/* Bonnes pratiques */}
      <section className="mb-8 bg-green-50 p-6 rounded-lg border border-green-200">
        <h3 className="text-xl font-bold text-green-900 mb-4">✅ Bonnes pratiques</h3>
        <ul className="space-y-3 text-green-800">
          {[
            ['1.', 'Envoyez les données chaque jour', 'Configurez votre système pour envoyer automatiquement les KPI à la fin de chaque journée de vente.'],
            ['2.', 'Ne partagez jamais votre clé API', 'Gardez-la secrète, comme un mot de passe. Ne la mettez pas dans des fichiers publics ou sur internet.'],
            ['3.', 'Régénérez votre clé régulièrement', 'Pour plus de sécurité, créez une nouvelle clé tous les 3-6 mois et désactivez l\'ancienne.'],
            ['4.', 'Testez d\'abord avec quelques données', 'Avant de mettre en production, testez avec 1 ou 2 vendeurs pour vérifier que tout fonctionne.'],
          ].map(([num, title, desc]) => (
            <li key={num} className="flex items-start gap-2">
              <span className="text-green-600 font-bold">{num}</span>
              <span><strong>{title}</strong> : {desc}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Documentation complète */}
      <section className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-lg border border-purple-200">
        <h3 className="text-xl font-bold text-purple-900 mb-3">📘 Documentation complète</h3>
        <p className="text-gray-700 mb-4">
          Pour une documentation complète avec tous les détails techniques, exemples de code, et cas d'usage avancés, téléchargez la notice PDF complète.
        </p>
      </section>

      {/* Support */}
      <section className="mt-8 bg-blue-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-xl font-bold text-blue-900 mb-3">💬 Besoin d'aide ?</h3>
        <p className="text-gray-700 mb-4">Si vous avez des questions ou rencontrez des difficultés, n'hésitez pas à contacter notre support technique.</p>
        <button
          onClick={onContactSupport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Contacter le support
        </button>
      </section>
    </div>
  );
}
