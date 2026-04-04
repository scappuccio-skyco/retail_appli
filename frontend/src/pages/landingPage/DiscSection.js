import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Users, Target, Brain, BarChart3 } from 'lucide-react';

const DISC_PROFILES = [
  {
    letter: 'D',
    name: 'Dominant',
    color: 'from-red-500 to-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    textColor: 'text-red-700',
    dot: 'bg-red-500',
    traits: ['Direct & décisif', 'Orienté résultats', 'Prend des décisions rapides', 'Aime les défis'],
    conseil: 'Donnez-lui de l\'autonomie et des objectifs ambitieux.',
  },
  {
    letter: 'I',
    name: 'Influent',
    color: 'from-yellow-400 to-orange-500',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    textColor: 'text-yellow-700',
    dot: 'bg-yellow-500',
    traits: ['Enthousiaste & sociable', 'Orienté relations', 'Communication expressive', 'Ambiance positive'],
    conseil: 'Valorisez-le publiquement et créez une ambiance stimulante.',
  },
  {
    letter: 'S',
    name: 'Stable',
    color: 'from-green-500 to-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    textColor: 'text-green-700',
    dot: 'bg-green-500',
    traits: ['Patient & loyal', 'Travail en équipe', 'Écoute attentive', 'Évite les conflits'],
    conseil: 'Rassurez-le sur les changements et valorisez sa contribution.',
  },
  {
    letter: 'C',
    name: 'Consciencieux',
    color: 'from-blue-500 to-blue-800',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    textColor: 'text-blue-700',
    dot: 'bg-blue-500',
    traits: ['Précis & analytique', 'Suit les procédures', 'Orienté détails', 'Exigeant envers lui-même'],
    conseil: 'Fournissez des données claires et respectez ses procédures.',
  },
];

const SELLER_STYLES = [
  { icon: '🤝', name: 'Le Convivial', base: 'I', desc: 'Fidélisation exceptionnelle, crée du lien naturellement', color: 'bg-blue-100 text-blue-800' },
  { icon: '🔍', name: "L'Explorateur", base: 'I/S', desc: 'Grande capacité de découverte client, curieux et apprenant', color: 'bg-green-100 text-green-800' },
  { icon: '⚡', name: 'Le Dynamique', base: 'D', desc: 'Volume de ventes élevé, énergie et efficacité naturelles', color: 'bg-red-100 text-red-800' },
  { icon: '🎧', name: 'Le Discret', base: 'S', desc: 'Excellente adaptation, clients sensibles et fidélisation silencieuse', color: 'bg-gray-100 text-gray-700' },
  { icon: '🎯', name: 'Le Stratège', base: 'C', desc: 'Ventes complexes, argumentation solide, maîtrise des objections', color: 'bg-purple-100 text-purple-800' },
];

export default function DiscSection() {
  const navigate = useNavigate();
  const [activeProfile, setActiveProfile] = useState(null);

  return (
    <section id="disc" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">

        {/* En-tête */}
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 bg-[#1E40AF]/10 text-[#1E40AF] text-sm font-semibold rounded-full mb-4">
            Intelligence Comportementale
          </span>
          <h2 className="text-4xl font-bold text-[#1E40AF] mb-5">
            Le Diagnostic DISC appliqué au Retail
          </h2>
          <p className="text-lg text-[#334155] max-w-3xl mx-auto leading-relaxed">
            Le profil DISC est la méthode de référence mondiale pour comprendre les comportements et adapter son management.
            Retail Performer AI l'intègre directement dans votre outil de pilotage — spécifiquement calibré pour les équipes de vente en magasin.
          </p>
        </div>

        {/* Les 4 profils DISC */}
        <div className="mb-16">
          <h3 className="text-xl font-semibold text-[#334155] text-center mb-8">
            Les 4 profils comportementaux de vos vendeurs et managers
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {DISC_PROFILES.map((profile) => (
              <div
                key={profile.letter}
                onClick={() => setActiveProfile(activeProfile === profile.letter ? null : profile.letter)}
                className={`rounded-2xl border-2 ${profile.border} ${profile.bg} p-6 cursor-pointer transition-all hover:shadow-lg ${activeProfile === profile.letter ? 'shadow-lg scale-[1.02]' : ''}`}
              >
                {/* Badge lettre */}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${profile.color} flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-md`}>
                  {profile.letter}
                </div>
                <h4 className={`text-lg font-bold ${profile.textColor} mb-1`}>Profil {profile.name}</h4>
                <ul className="space-y-1 mb-4">
                  {profile.traits.map((trait) => (
                    <li key={trait} className="flex items-center gap-2 text-sm text-[#334155]">
                      <span className={`w-1.5 h-1.5 rounded-full ${profile.dot} flex-shrink-0`} />
                      {trait}
                    </li>
                  ))}
                </ul>
                {activeProfile === profile.letter && (
                  <div className={`mt-3 p-3 bg-white rounded-xl border ${profile.border} text-sm text-[#334155] italic`}>
                    💡 {profile.conseil}
                  </div>
                )}
                <p className="text-xs text-[#64748B] mt-2 text-center">
                  {activeProfile === profile.letter ? 'Cliquer pour fermer' : 'Cliquer pour le conseil manager'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Deux diagnostics */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <div className="bg-gradient-to-br from-[#1E40AF] to-[#1E3A8A] rounded-2xl p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-sm">Pour vos vendeurs</p>
                <h3 className="text-xl font-bold">Diagnostic Vendeur</h3>
              </div>
            </div>
            <p className="text-white/80 text-sm mb-5 leading-relaxed">
              39 questions couvrant les 5 piliers de la vente retail (Accueil, Découverte, Argumentation, Closing, Fidélisation) et l'évaluation du profil DISC comportemental.
            </p>
            <div className="space-y-2">
              {['Score sur 5 compétences vente (0–10)', 'Profil DISC avec pourcentages', "Style vendeur parmi 5 profils retail", 'Niveau de progression gamifié', 'Résumé IA personnalisé'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-white/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#F97316] to-[#EA580C] rounded-2xl p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-sm">Pour vos managers</p>
                <h3 className="text-xl font-bold">Diagnostic Manager</h3>
              </div>
            </div>
            <p className="text-white/80 text-sm mb-5 leading-relaxed">
              35 questions évaluant le style de leadership, les pratiques de management et le profil comportemental DISC. L'IA génère un profil complet avec axes de progression.
            </p>
            <div className="space-y-2">
              {['Profil parmi 7 styles de management', 'Profil DISC avec pourcentages', '2 forces identifiées par l\'IA', 'Axe de progression prioritaire', 'Recommandation et exemple concret'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-white/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Les 5 styles vendeur */}
        <div className="mb-14">
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold text-[#334155]">
              5 styles vendeur retail identifiés par l'IA
            </h3>
            <p className="text-sm text-[#64748B] mt-1">Chaque vendeur obtient un profil unique, jamais générique</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {SELLER_STYLES.map((style) => (
              <div key={style.name} className="bg-[#F8FAFC] rounded-xl p-5 border border-gray-100 hover:border-[#1E40AF]/30 hover:shadow-md transition-all text-center">
                <div className="text-3xl mb-3">{style.icon}</div>
                <h4 className="font-bold text-[#1E40AF] text-sm mb-1">{style.name}</h4>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2 ${style.color}`}>
                  DISC {style.base}
                </span>
                <p className="text-xs text-[#334155] leading-relaxed">{style.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Matrice compatibilité - teaser */}
        <div className="bg-gradient-to-r from-blue-50 to-slate-50 border border-[#1E40AF]/20 rounded-2xl p-8 mb-14 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-shrink-0 w-16 h-16 bg-[#1E40AF]/10 rounded-2xl flex items-center justify-center">
            <Target className="w-8 h-8 text-[#1E40AF]" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg font-bold text-[#1E40AF] mb-2">Matrice de compatibilité Manager × Vendeur</h3>
            <p className="text-[#334155] text-sm leading-relaxed">
              L'application génère automatiquement les conseils de communication adaptés entre chaque manager et chaque vendeur selon leurs profils DISC respectifs. Un duo <strong>Coach × Explorateur</strong> ne se manage pas comme un duo <strong>Pilote × Dynamique</strong>.
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="flex items-center gap-1 text-sm text-[#64748B]">
              <BarChart3 className="w-4 h-4" />
              <span>Intégré dans la plateforme</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-[#64748B] text-sm mb-5">
            Inclus dans toutes les formules · Aucun abonnement psychométrique supplémentaire
          </p>
          <button
            onClick={() => navigate('/early-access')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-xl hover:scale-105 transition-all text-base"
          >
            Découvrir mon profil DISC
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-xs text-[#64748B] mt-3">Essai gratuit 30 jours · Sans carte bancaire</p>
        </div>

      </div>
    </section>
  );
}
