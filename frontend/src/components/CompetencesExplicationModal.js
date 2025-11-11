import React from 'react';
import { X } from 'lucide-react';

export default function CompetencesExplicationModal({ onClose }) {
  const competences = [
    {
      name: 'Accueil',
      icon: '👋',
      color: 'blue',
      description: 'Capacité à créer le premier contact et mettre le client à l\'aise',
      details: [
        'Sourire et attitude accueillante',
        'Reconnaissance immédiate du client',
        'Créer une atmosphère chaleureuse',
        'Gestion du premier regard et du premier mot'
      ],
      mesure: 'Basé sur le nombre de clients approchés et la qualité du premier contact'
    },
    {
      name: 'Découverte',
      icon: '🔍',
      color: 'green',
      description: 'Capacité à identifier les besoins et poser les bonnes questions',
      details: [
        'Questions ouvertes pertinentes',
        'Écoute active et reformulation',
        'Identification des besoins cachés',
        'Compréhension du contexte d\'usage'
      ],
      mesure: 'Basé sur le nombre d\'articles par vente (qualité de la découverte)'
    },
    {
      name: 'Argumentation',
      icon: '💬',
      color: 'purple',
      description: 'Capacité à présenter le produit et convaincre avec des arguments',
      details: [
        'Arguments adaptés aux besoins',
        'Mise en avant des bénéfices',
        'Démonstration de valeur',
        'Traitement des objections'
      ],
      mesure: 'Basé sur le panier moyen et l\'indice de vente (articles/clients)'
    },
    {
      name: 'Closing',
      icon: '🎯',
      color: 'red',
      description: 'Capacité à conclure la vente et gérer les dernières hésitations',
      details: [
        'Détection des signaux d\'achat',
        'Propositions de closing adaptées',
        'Gestion des dernières objections',
        'Finalisation rassurante'
      ],
      mesure: 'Basé sur le taux de transformation (ventes/clients)'
    },
    {
      name: 'Fidélisation',
      icon: '🤝',
      color: 'orange',
      description: 'Capacité à créer une relation durable et assurer le suivi',
      details: [
        'Conseils d\'utilisation personnalisés',
        'Programme de fidélité proposé',
        'Prise de coordonnées pour suivi',
        'Relation post-achat maintenue'
      ],
      mesure: 'Basé sur la régularité du CA et le retour des clients'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 border-blue-200 text-blue-900',
      green: 'bg-green-50 border-green-200 text-green-900',
      purple: 'bg-purple-50 border-purple-200 text-purple-900',
      red: 'bg-red-50 border-red-200 text-red-900',
      orange: 'bg-orange-50 border-orange-200 text-orange-900'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-white mb-2">📊 Les 5 Compétences de Vente</h2>
          <p className="text-white text-opacity-90">Comprends comment chaque compétence est mesurée et comment l'améliorer</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {competences.map((competence, idx) => (
              <div key={`competence-${competence.name}-${idx}`} className={`${getColorClasses(competence.color)} rounded-xl border-2 p-5`}>
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-4xl">{competence.icon}</span>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{competence.name}</h3>
                    <p className="text-sm opacity-90">{competence.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Ce qu'on évalue */}
                  <div className="bg-white bg-opacity-60 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 text-sm">✨ Ce qu'on évalue :</h4>
                    <ul className="space-y-1">
                      {competence.details.map((detail, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="opacity-60 mt-0.5">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Comment c'est mesuré */}
                  <div className="bg-white bg-opacity-60 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 text-sm">📏 Comment c'est mesuré :</h4>
                    <p className="text-sm">{competence.mesure}</p>
                    <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                      <p className="text-xs opacity-70">
                        Ton score évolue dans le temps : d'abord basé sur ton questionnaire, puis de plus en plus sur tes performances réelles (KPIs).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Info box */}
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4">
            <p className="text-sm text-gray-800">
              <strong>💡 Bon à savoir :</strong> Tes scores évoluent avec le temps ! Pendant les 2 premières semaines, ils sont basés à 100% sur ton questionnaire initial. Ensuite, ils intègrent progressivement tes KPIs réels pour refléter ta performance actuelle (70% KPIs après 1 mois).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 rounded-b-2xl text-center">
          <button
            onClick={onClose}
            className="btn-primary"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
}
