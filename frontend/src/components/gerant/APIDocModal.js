import React from 'react';
import { X, Book, ExternalLink } from 'lucide-react';

export default function APIDocModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <Book className="w-6 h-6 text-white" />
            <h2 className="text-2xl font-bold text-white">Guide d'Intégration API</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose prose-slate max-w-none">
            
            {/* Vue d'ensemble */}
            <section className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Vue d'ensemble</h3>
              <p className="text-gray-700">
                Ce guide décrit comment connecter vos logiciels externes (caisse, ERP, etc.) à Retail Performer AI via l'API REST.
              </p>
            </section>

            {/* Gestion des clés */}
            <section className="mb-8 bg-purple-50 p-6 rounded-lg border border-purple-200">
              <h3 className="text-xl font-bold text-purple-900 mb-4">🔑 Gestion des Clés API (Gérant uniquement)</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Créer une clé API</h4>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                    <li>Cliquez sur <strong>"Créer une nouvelle clé API"</strong></li>
                    <li>Remplissez le formulaire :
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li><strong>Nom</strong> : Identifiant de la clé (ex: "Caisse Magasin Paris")</li>
                        <li><strong>Permissions</strong> : Sélectionnez les permissions nécessaires</li>
                        <li><strong>Expiration</strong> : Optionnel - nombre de jours avant expiration</li>
                      </ul>
                    </li>
                    <li>Cliquez sur <strong>"Créer la clé"</strong></li>
                    <li className="text-red-600 font-semibold">⚠️ IMPORTANT : Copiez immédiatement la clé générée - elle ne sera plus affichée</li>
                  </ol>
                </div>
              </div>
            </section>

            {/* Authentification */}
            <section className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🔐 Authentification</h3>
              <p className="text-gray-700 mb-4">
                Toutes les requêtes API nécessitent une clé API dans le header :
              </p>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <code>X-API-Key: rp_live_votre_cle_api_ici</code>
              </div>
              <p className="text-xs text-gray-600 mt-2 italic">
                Note : Le format <code className="bg-gray-200 px-1 rounded">Authorization: Bearer [clé]</code> est également supporté
              </p>
            </section>

            {/* Endpoints */}
            <section className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🌐 Endpoints disponibles</h3>
              
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                <p className="text-blue-900 font-semibold">
                  💡 Note importante : Il existe deux endpoints GET différents, ne pas les confondre !
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300 mb-6">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Endpoint</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Type</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs bg-purple-50">/my-stores</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">GET</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">Lister magasins + personnel (IDs)</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs bg-green-50">/my-stats</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">GET</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">Statistiques (CA, ventes, articles)</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs bg-orange-50">/kpi/sync</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">POST</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">Synchroniser les KPI journaliers</td>
                    </tr>
                    <tr className="bg-blue-50">
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs font-bold">/stores</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm font-semibold">POST</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">Créer un magasin</td>
                    </tr>
                    <tr className="bg-blue-50">
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs font-bold">/stores/{'{'}id{'}'}/managers</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm font-semibold">POST</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">Créer un manager</td>
                    </tr>
                    <tr className="bg-blue-50">
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs font-bold">/stores/{'{'}id{'}'}/sellers</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm font-semibold">POST</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">Créer un vendeur</td>
                    </tr>
                    <tr className="bg-blue-50">
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs font-bold">/users/{'{'}id{'}'}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm font-semibold">PUT</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">Mettre à jour un utilisateur</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Endpoint 1 : my-stores */}
              <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-bold text-purple-900 mb-3">
                  1. GET /api/v1/integrations/my-stores 👥
                </h4>
                <p className="text-gray-700 mb-4">
                  Récupère la liste complète de tous les magasins accessibles avec leur personnel. 
                  <strong className="text-purple-600"> Idéal pour obtenir les IDs nécessaires avant d'envoyer des KPI.</strong>
                </p>
                
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto mb-3">
                  <div className="text-green-400">GET</div>
                  <div className="text-blue-300">https://retailperformerai.com/api/v1/integrations/my-stores</div>
                  <div className="mt-2 text-gray-400">Headers:</div>
                  <div className="text-yellow-300">X-API-Key: rp_live_votre_cle_api_ici</div>
                </div>

                <p className="text-sm text-gray-600 italic">
                  Retourne : IDs des magasins, managers et vendeurs avec leurs informations complètes
                </p>
              </div>

              {/* Endpoint 2 : my-stats */}
              <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-bold text-green-900 mb-3">
                  2. GET /api/v1/integrations/my-stats 📊
                </h4>
                <p className="text-gray-700 mb-4">
                  Récupère les statistiques agrégées (CA, ventes, articles) sur une période donnée.
                </p>
                
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto mb-3">
                  <div className="text-green-400">GET</div>
                  <div className="text-blue-300">https://retailperformerai.com/api/v1/integrations/my-stats</div>
                  <div className="mt-2 text-gray-400">Query Params:</div>
                  <div className="text-yellow-300">start_date=2024-01-01&end_date=2024-01-31</div>
                  <div className="mt-2 text-gray-400">Headers:</div>
                  <div className="text-yellow-300">X-API-Key: rp_live_votre_cle_api_ici</div>
                </div>

                <p className="text-sm text-gray-600 italic">
                  Retourne : Statistiques agrégées par magasin (CA total, nombre de ventes, articles vendus)
                </p>
              </div>

              {/* Endpoint 3 : POST kpi */}
              <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-bold text-orange-900 mb-3">
                  3. POST /api/v1/integrations/kpi ✍️
                </h4>
                
                <div className="bg-purple-50 border-l-4 border-purple-500 p-3 mb-4">
                  <p className="text-sm text-purple-900 font-semibold mb-2">
                    💡 Plusieurs façons d'enregistrer les KPI :
                  </p>
                  <ul className="text-xs text-purple-800 ml-4 space-y-1">
                    <li>• <strong>Via API (API Key)</strong> : <code className="bg-purple-200 px-1 rounded">/v1/integrations/kpi/sync</code> - Pour systèmes externes (caisse, ERP)</li>
                    <li>• <strong>Via Web (JWT) - Vendeur</strong> : <code className="bg-purple-200 px-1 rounded">/seller/kpi-entry</code> - Le vendeur enregistre ses propres KPI</li>
                    <li>• <strong>Via Web (JWT) - Manager</strong> : <code className="bg-purple-200 px-1 rounded">/manager/store-kpi</code> - Le manager enregistre les KPI de ses vendeurs</li>
                  </ul>
                </div>
                
                <p className="text-gray-700 mb-4">
                  Envoie les KPI journaliers d'un vendeur (CA, nombre de ventes, articles vendus, prospects).
                </p>
                
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto mb-3">
                  <div className="text-orange-400">POST</div>
                  <div className="text-blue-300">https://retailperformerai.com/api/v1/integrations/kpi</div>
                  <div className="mt-2 text-gray-400">Headers:</div>
                  <div className="text-yellow-300">X-API-Key: rp_live_votre_cle_api_ici</div>
                  <div className="text-yellow-300">Content-Type: application/json</div>
                  <div className="mt-2 text-gray-400">Body:</div>
                  <pre className="text-green-300 mt-1">{`{
  "seller_id": "uuid-du-vendeur",
  "date": "2024-01-15",
  "ca_journalier": 1250.50,
  "nb_ventes": 12,
  "nb_articles": 28,
  "prospects": 35
}`}</pre>
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-3">
                  <p className="text-sm text-blue-900">
                    <strong>📊 Champs disponibles :</strong>
                  </p>
                  <ul className="text-xs text-blue-800 mt-2 ml-4 space-y-1">
                    <li>• <code className="bg-blue-200 px-1 rounded">seller_id</code> <span className="text-red-600">(requis)</span> : ID du vendeur</li>
                    <li>• <code className="bg-blue-200 px-1 rounded">date</code> <span className="text-red-600">(requis)</span> : Date YYYY-MM-DD</li>
                    <li>• <code className="bg-blue-200 px-1 rounded">ca_journalier</code> <span className="text-red-600">(requis)</span> : Chiffre d'affaires en €</li>
                    <li>• <code className="bg-blue-200 px-1 rounded">nb_ventes</code> <span className="text-red-600">(requis)</span> : Nombre de ventes</li>
                    <li>• <code className="bg-blue-200 px-1 rounded">nb_articles</code> <span className="text-red-600">(requis)</span> : Nombre d'articles vendus</li>
                    <li>• <code className="bg-blue-200 px-1 rounded">prospects</code> <span className="text-green-600">(optionnel)</span> : Nombre de prospects/clients entrés dans le magasin (flux entrant)</li>
                  </ul>
                </div>

                <p className="text-sm text-gray-600 italic">
                  💡 <strong>Le champ "prospects"</strong> permet de calculer automatiquement le <strong>taux de transformation</strong> = (nb_ventes / prospects) × 100
                </p>
                
                <p className="text-sm text-gray-600 italic mt-2">
                  ⚠️ Utilisez l'endpoint <code className="bg-gray-200 px-1 rounded">/my-stores</code> pour récupérer les seller_id
                </p>
              </div>
            </section>

            {/* Gestion des Utilisateurs */}
            <section className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">👥 Gestion des Utilisateurs via API</h3>
              
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                <p className="text-sm text-blue-900">
                  <strong>Permissions requises :</strong> <code className="bg-blue-200 px-2 py-1 rounded">write:stores</code> (pour créer des magasins) 
                  et <code className="bg-blue-200 px-2 py-1 rounded">write:users</code> (pour gérer les utilisateurs)
                </p>
              </div>

              {/* Endpoint 4 : POST /stores */}
              <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-bold text-blue-900 mb-3">
                  4. POST /api/v1/integrations/stores 🏪
                </h4>
                <p className="text-gray-700 mb-4">
                  Créer un nouveau magasin. <strong className="text-red-600">Réservé aux gérants uniquement.</strong>
                </p>
                
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto mb-3">
                  <div className="text-blue-400">POST</div>
                  <div className="text-blue-300">https://retailperformerai.com/api/v1/integrations/stores</div>
                  <div className="mt-2 text-gray-400">Headers:</div>
                  <div className="text-yellow-300">X-API-Key: rp_live_votre_cle_api_ici</div>
                  <div className="text-yellow-300">Content-Type: application/json</div>
                  <div className="mt-2 text-gray-400">Body:</div>
                  <pre className="text-green-300 mt-1">{`{
  "name": "Skyco Marseille",
  "location": "13001 Marseille",
  "address": "12 Rue de la République",
  "phone": "+33 4 91 00 00 00",
  "external_id": "STORE_MRS_001"
}`}</pre>
                </div>

                <p className="text-sm text-gray-600 italic">
                  Retourne : <code className="bg-gray-200 px-1 rounded">store_id</code> du magasin créé
                </p>
              </div>

              {/* Endpoint 5 : POST /managers */}
              <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-bold text-indigo-900 mb-3">
                  5. POST /api/v1/integrations/stores/{'{'}store_id{'}'}/managers 👔
                </h4>
                <p className="text-gray-700 mb-4">
                  Créer un nouveau manager pour un magasin spécifique.
                </p>
                
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto mb-3">
                  <div className="text-indigo-400">POST</div>
                  <div className="text-blue-300">https://retailperformerai.com/api/v1/integrations/stores/{'{'}<span className="text-yellow-300">store_id</span>{'}'}/managers</div>
                  <div className="mt-2 text-gray-400">Headers:</div>
                  <div className="text-yellow-300">X-API-Key: rp_live_votre_cle_api_ici</div>
                  <div className="text-yellow-300">Content-Type: application/json</div>
                  <div className="mt-2 text-gray-400">Body:</div>
                  <pre className="text-green-300 mt-1">{`{
  "name": "Sophie Martin",
  "email": "sophie.martin@example.com",
  "phone": "+33 6 12 34 56 78",
  "external_id": "MGR_MRS_001",
  "send_invitation": true
}`}</pre>
                </div>

                <p className="text-sm text-gray-600 italic">
                  📧 Un email d'invitation sera envoyé si <code className="bg-gray-200 px-1 rounded">send_invitation: true</code>
                </p>
              </div>

              {/* Endpoint 6 : POST /sellers */}
              <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-bold text-purple-900 mb-3">
                  6. POST /api/v1/integrations/stores/{'{'}store_id{'}'}/sellers 👤
                </h4>
                <p className="text-gray-700 mb-4">
                  Créer un nouveau vendeur pour un magasin spécifique.
                </p>
                
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto mb-3">
                  <div className="text-purple-400">POST</div>
                  <div className="text-blue-300">https://retailperformerai.com/api/v1/integrations/stores/{'{'}<span className="text-yellow-300">store_id</span>{'}'}/sellers</div>
                  <div className="mt-2 text-gray-400">Headers:</div>
                  <div className="text-yellow-300">X-API-Key: rp_live_votre_cle_api_ici</div>
                  <div className="text-yellow-300">Content-Type: application/json</div>
                  <div className="mt-2 text-gray-400">Body:</div>
                  <pre className="text-green-300 mt-1">{`{
  "name": "Lucas Bernard",
  "email": "lucas.bernard@example.com",
  "manager_id": "uuid-du-manager",
  "phone": "+33 6 98 76 54 32",
  "external_id": "SELLER_MRS_012",
  "send_invitation": true
}`}</pre>
                </div>

                <p className="text-sm text-gray-600 italic">
                  💡 Si <code className="bg-gray-200 px-1 rounded">manager_id</code> n'est pas fourni, un manager sera automatiquement assigné
                </p>
              </div>

              {/* Endpoint 7 : PUT /users */}
              <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-bold text-green-900 mb-3">
                  7. PUT /api/v1/integrations/users/{'{'}user_id{'}'} 🔄
                </h4>
                <p className="text-gray-700 mb-4">
                  Mettre à jour les informations d'un manager ou vendeur (nom, email, statut, etc.)
                </p>
                
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto mb-3">
                  <div className="text-green-400">PUT</div>
                  <div className="text-blue-300">https://retailperformerai.com/api/v1/integrations/users/{'{'}<span className="text-yellow-300">user_id</span>{'}'}</div>
                  <div className="mt-2 text-gray-400">Headers:</div>
                  <div className="text-yellow-300">X-API-Key: rp_live_votre_cle_api_ici</div>
                  <div className="text-yellow-300">Content-Type: application/json</div>
                  <div className="mt-2 text-gray-400">Body:</div>
                  <pre className="text-green-300 mt-1">{`{
  "name": "Lucas Bernard-Dupont",
  "email": "lucas.dupont@example.com",
  "phone": "+33 6 11 22 33 44",
  "status": "suspended",
  "external_id": "SELLER_MRS_012_NEW"
}`}</pre>
                </div>

                <p className="text-sm text-gray-600 italic">
                  ⏸️ Utilisez <code className="bg-gray-200 px-1 rounded">status: "suspended"</code> pour mettre un utilisateur en veille
                </p>
              </div>
            </section>

            {/* Exemples de code */}
            <section className="mb-8 bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-gray-900 mb-4">💻 Exemples de code</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">curl (Bash)</h4>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`# Récupérer les magasins
curl -X GET "https://retailperformerai.com/api/v1/integrations/my-stores" \\
  -H "X-API-Key: rp_live_votre_cle"

# Envoyer des KPI
curl -X POST "https://retailperformerai.com/api/v1/integrations/kpi" \\
  -H "X-API-Key: rp_live_votre_cle" \\
  -H "Content-Type: application/json" \\
  -d '{
    "seller_id": "uuid-vendeur",
    "date": "2024-01-15",
    "ca_journalier": 1250.50,
    "nb_ventes": 12,
    "nb_articles": 28
  }'`}</pre>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Python</h4>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`import requests

API_KEY = "rp_live_votre_cle"
BASE_URL = "https://retailperformerai.com/api/v1/integrations"

# Récupérer les magasins
response = requests.get(
    f"{BASE_URL}/my-stores",
    headers={"X-API-Key": API_KEY}
)
stores = response.json()

# Envoyer des KPI
kpi_data = {
    "seller_id": "uuid-vendeur",
    "date": "2024-01-15",
    "ca_journalier": 1250.50,
    "nb_ventes": 12,
    "nb_articles": 28
}
response = requests.post(
    f"{BASE_URL}/kpi",
    headers={"X-API-Key": API_KEY},
    json=kpi_data
)`}</pre>
                  </div>
                </div>
              </div>
            </section>

            {/* Support */}
            <section className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-lg border border-purple-200">
              <h3 className="text-xl font-bold text-purple-900 mb-3">💬 Besoin d'aide ?</h3>
              <p className="text-gray-700 mb-4">
                Pour toute question sur l'utilisation de l'API, contactez le support technique.
              </p>
              <a
                href="mailto:support@retailperformerai.com"
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Contacter le support
              </a>
            </section>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
