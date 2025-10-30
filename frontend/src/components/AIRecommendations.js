import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function AIRecommendations({ recommendations }) {
  if (!recommendations) return null;

  return (
    <div className="glass-morphism rounded-2xl p-6 border-2 border-green-200 bg-green-50">
      <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
        <CheckCircle className="w-8 h-8 text-green-600" />
        Recommandations IA personnalisées
      </h3>

      <div className="space-y-6">
        {/* Analyse de la situation */}
        <div className="bg-white rounded-xl p-5">
          <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            Analyse de la situation
          </h4>
          <p className="text-gray-700 whitespace-pre-line">{recommendations.ai_analyse_situation}</p>
        </div>

        {/* Approche de communication */}
        {recommendations.ai_approche_communication && (
          <div className="bg-white rounded-xl p-5">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              💬 Approche de communication
            </h4>
            <p className="text-gray-700 whitespace-pre-line">{recommendations.ai_approche_communication}</p>
          </div>
        )}

        {/* Actions concrètes */}
        {recommendations.ai_actions_concretes && recommendations.ai_actions_concretes.length > 0 && (
          <div className="bg-white rounded-xl p-5">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              ✅ Actions concrètes à mettre en place
            </h4>
            <ul className="space-y-2">
              {recommendations.ai_actions_concretes.map((action, index) => (
                <li key={`action-${index}`} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="text-gray-700 flex-1">{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Points de vigilance */}
        {recommendations.ai_points_vigilance && recommendations.ai_points_vigilance.length > 0 && (
          <div className="bg-white rounded-xl p-5">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              ⚠️ Points de vigilance
            </h4>
            <ul className="space-y-2">
              {recommendations.ai_points_vigilance.map((point, index) => (
                <li key={`vigilance-${index}`} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-sm font-bold">
                    !
                  </span>
                  <span className="text-gray-700 flex-1">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Metadata */}
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
          <p>
            <strong>Date :</strong> {new Date(recommendations.created_at).toLocaleDateString('fr-FR', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          <p><strong>Statut :</strong> {recommendations.statut}</p>
        </div>
      </div>
    </div>
  );
}
