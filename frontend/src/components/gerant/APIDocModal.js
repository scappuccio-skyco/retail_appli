import React, { useState } from 'react';
import { X, Book, ExternalLink, Download } from 'lucide-react';
import { API_BASE } from '../../lib/api';
import SupportModal from '../SupportModal';

export default function APIDocModal({ isOpen, onClose }) {
  const [showSupportModal, setShowSupportModal] = useState(false);
  
  if (!isOpen) return null;

  const handleDownloadPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('Vous devez être connecté pour télécharger le PDF.');
        return;
      }

      const response = await fetch(`${API_BASE}/api/docs/integrations.pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur serveur:', response.status, errorText);
        throw new Error(`Erreur ${response.status}: ${errorText || 'Erreur lors du téléchargement du PDF'}`);
      }

      const blob = await response.blob();
      
      // Vérifier que c'est bien un PDF
      if (blob.type && blob.type !== 'application/pdf' && !blob.type.includes('pdf')) {
        console.error('Type de fichier reçu:', blob.type);
        // Ne pas bloquer si le type n'est pas défini (certains serveurs ne le renvoient pas)
        if (blob.type) {
          throw new Error('Le fichier reçu n\'est pas un PDF');
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'NOTICE_API_INTEGRATIONS.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erreur lors du téléchargement du PDF:', error);
      alert(`Erreur lors du téléchargement du PDF: ${error.message || 'Veuillez réessayer.'}`);
    }
  };

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
                            <li><code className="bg-purple-200 px-1 rounded text-xs">stores:read</code> - Lire les magasins</li>
                            <li><code className="bg-purple-200 px-1 rounded text-xs">stores:write</code> - Créer des magasins</li>
                            <li><code className="bg-purple-200 px-1 rounded text-xs">users:write</code> - Créer/modifier des utilisateurs</li>
                            <li><code className="bg-purple-200 px-1 rounded text-xs">kpi:write</code> - Synchroniser les KPI</li>
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
              <p className="text-gray-700 mb-4">
                Pour utiliser l'API, vous devez inclure votre clé API dans chaque requête. Il y a deux façons de faire :
              </p>
              
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

            {/* Endpoint principal */}
            <section className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Synchroniser les KPI (Chiffres de vente)</h3>
              
              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4 rounded">
                <p className="text-green-900 font-semibold mb-2">
                  ✅ Endpoint disponible : POST /api/integrations/kpi/sync
                </p>
                <p className="text-green-800 text-sm">
                  Cet endpoint permet d'envoyer les données de vente (CA, nombre de ventes, articles vendus) depuis votre caisse ou ERP vers Retail Performer AI.
                </p>
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
                  <p className="text-gray-700 mb-3">
                    Vous pouvez envoyer les données de vente pour un ou plusieurs vendeurs en une seule fois (maximum 100 vendeurs par requête).
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre className="text-green-300">{`{
  "store_id": "id-du-magasin",
  "date": "2024-01-15",
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
                      <li>
                        <strong className="text-blue-900">store_id</strong> : 
                        <span className="text-blue-800"> L'identifiant de votre magasin (vous le trouvez dans l'interface)</span>
                      </li>
                      <li>
                        <strong className="text-blue-900">date</strong> : 
                        <span className="text-blue-800"> La date au format AAAA-MM-JJ (ex: 2024-01-15)</span>
                      </li>
                      <li>
                        <strong className="text-blue-900">seller_id</strong> : 
                        <span className="text-blue-800"> L'identifiant du vendeur (vous le trouvez dans l'interface)</span>
                      </li>
                      <li>
                        <strong className="text-blue-900">ca_journalier</strong> : 
                        <span className="text-blue-800"> Le chiffre d'affaires de la journée en euros (ex: 1250.50)</span>
                      </li>
                      <li>
                        <strong className="text-blue-900">nb_ventes</strong> : 
                        <span className="text-blue-800"> Le nombre de ventes effectuées (ex: 12)</span>
                      </li>
                      <li>
                        <strong className="text-blue-900">nb_articles</strong> : 
                        <span className="text-blue-800"> Le nombre d'articles vendus (ex: 28)</span>
                      </li>
                      <li>
                        <strong className="text-blue-900">prospects</strong> : 
                        <span className="text-blue-800"> (Optionnel) Le nombre de clients/prospects rencontrés (ex: 35)</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">💡 Comment obtenir les IDs (store_id, seller_id) ?</h4>
                  <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
                    <p className="text-purple-900 text-sm mb-2">
                      <strong>Option 1 : Depuis l'interface web</strong>
                    </p>
                    <p className="text-purple-800 text-sm mb-3">
                      Connectez-vous à l'interface gérant, allez dans "Mes magasins" et "Mon équipe". Les IDs sont visibles dans l'URL ou dans les détails de chaque magasin/vendeur.
                    </p>
                    <p className="text-purple-900 text-sm mb-2">
                      <strong>Option 2 : Via l'API App (JWT)</strong>
                    </p>
                    <p className="text-purple-800 text-sm">
                      Utilisez <code className="bg-purple-200 px-1 rounded">GET /api/stores/my-stores</code> avec votre token JWT (depuis l'interface web) pour obtenir la liste des magasins et leurs vendeurs.
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">✅ Réponse de l'API</h4>
                  <p className="text-gray-700 mb-2">
                    Si tout s'est bien passé, l'API vous répond :
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs">
                    <pre className="text-green-300">{`{
  "status": "success",
  "entries_created": 1,
  "entries_updated": 0,
  "total": 1
}`}</pre>
                  </div>
                  <p className="text-gray-600 text-sm mt-2">
                    Cela signifie que 1 nouvelle entrée a été créée. Si vous envoyez les mêmes données le lendemain, elles seront mises à jour automatiquement.
                  </p>
                </div>
              </div>
            </section>

            {/* Gestion des magasins */}
            <section className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🏪 Gérer les magasins via l'API</h3>
              
              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4 rounded">
                <p className="text-green-900 font-semibold mb-2">
                  ✅ Endpoints disponibles :
                </p>
                <ul className="text-green-800 text-sm space-y-1 ml-4">
                  <li>• <code className="bg-green-200 px-1 rounded">GET /api/integrations/stores</code> - Lister vos magasins</li>
                  <li>• <code className="bg-green-200 px-1 rounded">POST /api/integrations/stores</code> - Créer un nouveau magasin</li>
                </ul>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">📋 Lister les magasins</h4>
                  <p className="text-gray-700 mb-3">
                    Récupérez la liste de tous vos magasins (ou seulement ceux autorisés si votre clé est restreinte).
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre className="text-green-300">{`curl -X GET "https://api.retailperformerai.com/api/integrations/stores" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici"`}</pre>
                  </div>
                  <p className="text-gray-600 text-sm mt-2">
                    <strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">stores:read</code>
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">➕ Créer un magasin</h4>
                  <p className="text-gray-700 mb-3">
                    Créez un nouveau magasin depuis votre ERP ou système de gestion.
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre className="text-green-300">{`curl -X POST "https://api.retailperformerai.com/api/integrations/stores" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Magasin Lyon Centre",
    "location": "69001 Lyon",
    "address": "456 Rue de la République",
    "phone": "0123456789"
  }'`}</pre>
                  </div>
                  <p className="text-gray-600 text-sm mt-2">
                    <strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">stores:write</code>
                  </p>
                </div>
              </div>
            </section>

            {/* Gestion des managers */}
            <section className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">👔 Gérer les managers via l'API</h3>
              
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded">
                <p className="text-blue-900 font-semibold mb-2">
                  ✅ Endpoint disponible : POST /api/integrations/stores/{`{store_id}`}/managers
                </p>
                <p className="text-blue-800 text-sm">
                  Créez un nouveau manager pour un magasin. Le manager sera automatiquement assigné au magasin spécifié dans l'URL.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">➕ Créer un manager</h4>
                  <p className="text-gray-700 mb-3">
                    Créez un manager depuis votre système RH. Le manager sera automatiquement lié au magasin indiqué dans l'URL.
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre className="text-green-300">{`curl -X POST "https://api.retailperformerai.com/api/integrations/stores/store-123/managers" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jean Dupont",
    "email": "jean.dupont@example.com",
    "phone": "0123456789"
  }'`}</pre>
                  </div>
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-3 rounded">
                    <p className="text-yellow-900 text-sm">
                      <strong>⚠️ Important :</strong> Le magasin est déterminé par l'URL (<code className="bg-yellow-200 px-1 rounded">/stores/store-123/managers</code>). Tout <code className="bg-yellow-200 px-1 rounded">store_id</code> dans le body sera ignoré.
                    </p>
                  </div>
                  <p className="text-gray-600 text-sm mt-2">
                    <strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">users:write</code>
                  </p>
                </div>
              </div>
            </section>

            {/* Gestion des vendeurs */}
            <section className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">👤 Gérer les vendeurs via l'API</h3>
              
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-4 rounded">
                <p className="text-purple-900 font-semibold mb-2">
                  ✅ Endpoint disponible : POST /api/integrations/stores/{`{store_id}`}/sellers
                </p>
                <p className="text-purple-800 text-sm">
                  Créez un nouveau vendeur pour un magasin. Le vendeur sera automatiquement assigné au magasin et à un manager.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">➕ Créer un vendeur</h4>
                  <p className="text-gray-700 mb-3">
                    Créez un vendeur depuis votre système RH. Le vendeur sera automatiquement lié au magasin indiqué dans l'URL.
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre className="text-green-300">{`curl -X POST "https://api.retailperformerai.com/api/integrations/stores/store-123/sellers" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Marie Martin",
    "email": "marie.martin@example.com",
    "phone": "0123456789",
    "manager_id": "manager-789"
  }'`}</pre>
                  </div>
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-3 rounded">
                    <p className="text-yellow-900 text-sm">
                      <strong>💡 Note :</strong> Si vous ne spécifiez pas de <code className="bg-yellow-200 px-1 rounded">manager_id</code>, un manager actif du magasin sera assigné automatiquement.
                    </p>
                  </div>
                  <p className="text-gray-600 text-sm mt-2">
                    <strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">users:write</code>
                  </p>
                </div>
              </div>
            </section>

            {/* Mise à jour des utilisateurs */}
            <section className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">✏️ Modifier les utilisateurs via l'API</h3>
              
              <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-4 rounded">
                <p className="text-indigo-900 font-semibold mb-2">
                  ✅ Endpoint disponible : PUT /api/integrations/users/{`{user_id}`}
                </p>
                <p className="text-indigo-800 text-sm">
                  Modifiez les informations d'un utilisateur (manager ou vendeur). Seuls certains champs peuvent être modifiés.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">📝 Modifier un utilisateur</h4>
                  <p className="text-gray-700 mb-3">
                    Mettez à jour le nom, téléphone, statut ou ID externe d'un utilisateur.
                  </p>
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
                  <p className="text-gray-600 text-sm mt-2">
                    <strong>Permission requise :</strong> <code className="bg-gray-200 px-1 rounded">users:write</code>
                  </p>
                </div>
              </div>
            </section>

            {/* Exemples pratiques */}
            <section className="mb-8 bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-gray-900 mb-4">💻 Exemples pour votre développeur</h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Exemple avec cURL (Bash/Linux/Mac)</h4>
                  <p className="text-gray-600 text-sm mb-2">
                    Cette commande peut être utilisée dans un script automatique qui s'exécute chaque jour :
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre className="text-green-300">{`curl -X POST "https://api.retailperformerai.com/api/integrations/kpi/sync" \\
  -H "X-API-Key: sk_live_votre_cle_api_ici" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store_id": "votre-store-id",
    "date": "2024-01-15",
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
                  <p className="text-gray-600 text-sm mb-2">
                    Code Python que votre développeur peut intégrer dans votre système de caisse :
                  </p>
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
              </div>
            </section>

            {/* Erreurs fréquentes */}
            <section className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">❓ Problèmes fréquents</h3>
              
              <div className="space-y-4">
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                  <p className="text-red-900 font-semibold mb-2">❌ Erreur 401 : Clé API invalide</p>
                  <p className="text-red-800 text-sm">
                    <strong>Solution :</strong> Vérifiez que vous avez bien copié la clé API complète (elle commence par <code className="bg-red-200 px-1 rounded">sk_live_</code>). Assurez-vous qu'il n'y a pas d'espaces avant ou après la clé.
                  </p>
                </div>

                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                  <p className="text-red-900 font-semibold mb-2">❌ Erreur 403 : Permissions insuffisantes</p>
                  <p className="text-red-800 text-sm">
                    <strong>Solution :</strong> Vérifiez que votre clé API a bien la permission "Synchroniser les KPI" (permission <code className="bg-red-200 px-1 rounded">write:kpi</code>). Si ce n'est pas le cas, créez une nouvelle clé avec cette permission.
                  </p>
                </div>

                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                  <p className="text-red-900 font-semibold mb-2">❌ Erreur 400 : Données invalides</p>
                  <p className="text-red-800 text-sm">
                    <strong>Solution :</strong> Vérifiez que :
                    <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                      <li>La date est au format AAAA-MM-JJ (ex: 2024-01-15)</li>
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
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">1.</span>
                  <span><strong>Envoyez les données chaque jour</strong> : Configurez votre système pour envoyer automatiquement les KPI à la fin de chaque journée de vente.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">2.</span>
                  <span><strong>Ne partagez jamais votre clé API</strong> : Gardez-la secrète, comme un mot de passe. Ne la mettez pas dans des fichiers publics ou sur internet.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">3.</span>
                  <span><strong>Régénérez votre clé régulièrement</strong> : Pour plus de sécurité, créez une nouvelle clé tous les 3-6 mois et désactivez l'ancienne.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">4.</span>
                  <span><strong>Testez d'abord avec quelques données</strong> : Avant de mettre en production, testez avec 1 ou 2 vendeurs pour vérifier que tout fonctionne.</span>
                </li>
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
              <p className="text-gray-700 mb-4">
                Si vous avez des questions ou rencontrez des difficultés, n'hésitez pas à contacter notre support technique.
              </p>
              <button
                onClick={() => setShowSupportModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Contacter le support
              </button>
            </section>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Télécharger en PDF
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* Support Modal */}
      <SupportModal 
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
    </div>
  );
}
