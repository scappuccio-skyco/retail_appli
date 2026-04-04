import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Brain } from 'lucide-react';

const DISC_PROFILES = [
  {
    letter: 'D',
    name: 'Dominant',
    color: 'from-red-500 to-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    textColor: 'text-red-700',
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
    traits: ['Précis & analytique', 'Suit les procédures', 'Orienté détails', 'Exigeant envers lui-même'],
    conseil: 'Fournissez des données claires et respectez ses procédures.',
  },
];

const SELLER_STYLES = [
  { icon: '🤝', name: 'Le Convivial', base: 'I', desc: 'Fidélisation exceptionnelle, crée du lien naturellement', color: 'bg-blue-100 text-blue-800' },
  { icon: '🔍', name: "L'Explorateur", base: 'I/S', desc: 'Grande capacité de découverte client, curieux et apprenant', color: 'bg-green-100 text-green-800' },
  { icon: '⚡', name: 'Le Dynamique', base: 'D', desc: 'Volume de ventes élevé, énergie et efficacité naturelles', color: 'bg-red-100 text-red-800' },
  { icon: '🎧', name: 'Le Discret', base: 'S', desc: 'Excellente adaptation, fidélisation silencieuse et durable', color: 'bg-gray-100 text-gray-700' },
  { icon: '🎯', name: 'Le Stratège', base: 'C', desc: 'Ventes complexes, argumentation solide, maîtrise des objections', color: 'bg-purple-100 text-purple-800' },
];

const MANAGER_PROFILES = [
  {
    icon: '✈️',
    name: 'Le Pilote',
    base: 'D',
    color: 'bg-red-100 text-red-800',
    border: 'border-red-200',
    desc: 'Direct et exigeant. Fixe des objectifs élevés et pousse ses équipes à se dépasser.',
    force: 'Rapidité de décision, cap clair',
    vigilance: 'Peut manquer de patience avec les profils S',
  },
  {
    icon: '💡',
    name: 'Le Dynamiseur',
    base: 'I',
    color: 'bg-yellow-100 text-yellow-800',
    border: 'border-yellow-200',
    desc: 'Communicant, fédérateur. Crée l\'énergie collective et valorise chaque succès.',
    force: 'Motivation d\'équipe, ambiance positive',
    vigilance: 'Doit structurer davantage pour les profils C',
  },
  {
    icon: '🤝',
    name: 'Le Facilitateur',
    base: 'S',
    color: 'bg-green-100 text-green-800',
    border: 'border-green-200',
    desc: 'À l\'écoute, bienveillant. Crée un environnement de confiance où chacun s\'exprime.',
    force: 'Fidélisation équipe, gestion des tensions',
    vigilance: 'Peut éviter les confrontations nécessaires',
  },
  {
    icon: '📊',
    name: 'Le Stratège',
    base: 'C',
    color: 'bg-blue-100 text-blue-800',
    border: 'border-blue-200',
    desc: 'Rigoureux et analytique. Pilote par les données et optimise chaque process.',
    force: 'Précision, analyse KPI, cohérence',
    vigilance: 'Communication à adapter pour les profils I',
  },
  {
    icon: '🎯',
    name: 'Le Tacticien',
    base: 'D/C',
    color: 'bg-indigo-100 text-indigo-800',
    border: 'border-indigo-200',
    desc: 'Objectifs précis + méthode rigoureuse. Allie efficacité et organisation.',
    force: 'Exécution impeccable, suivi des résultats',
    vigilance: 'Besoin de flexibilité avec les imprévus',
  },
  {
    icon: '🌱',
    name: 'Le Coach',
    base: 'I/S',
    color: 'bg-teal-100 text-teal-800',
    border: 'border-teal-200',
    desc: 'Centré sur le développement humain. Accompagne chaque vendeur dans sa progression.',
    force: 'Montée en compétence, engagement individuel',
    vigilance: 'Doit aussi tenir le cap sur les KPI',
  },
  {
    icon: '📚',
    name: 'Le Mentor',
    base: 'S/C',
    color: 'bg-orange-100 text-orange-800',
    border: 'border-orange-200',
    desc: 'Transmet avec patience et précision. Ses équipes progressent vite et durablement.',
    force: 'Formation, expertise partagée, stabilité',
    vigilance: 'Peut hésiter à pousser hors de la zone de confort',
  },
];

const COMPAT_EXAMPLES = [
  { manager: 'Le Pilote', vendeur: 'Le Dynamique', score: '⭐⭐⭐⭐⭐', label: 'Duo de feu', good: true, desc: 'Même énergie, même ambition. Résultats excellents si le manager laisse de l\'autonomie.' },
  { manager: 'Le Pilote', vendeur: 'Le Discret', score: '⭐⭐', label: 'Attention', good: false, desc: 'Rythmes opposés. Le Discret peut se sentir brusqué. Adapter son approche est clé.' },
  { manager: 'Le Coach', vendeur: 'Le Convivial', score: '⭐⭐⭐⭐', label: 'Duo harmonieux', good: true, desc: 'Relation de confiance naturelle. Le Convivial s\'épanouit dans ce cadre bienveillant.' },
];

export default function DiscSection() {
  const navigate = useNavigate();
  const [activeProfile, setActiveProfile] = useState(null);
  const [activeManagerProfile, setActiveManagerProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('vendeur');

  return (
    <section id="disc" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">

        {/* En-tête */}
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 bg-[#1E40AF]/10 text-[#1E40AF] text-sm font-semibold rounded-full mb-4">
            Intelligence Comportementale
          </span>
          <h2 className="text-4xl font-bold text-[#1E40AF] mb-5">
            Le Diagnostic DISC appliqué au Retail
          </h2>
          <p className="text-lg text-[#334155] max-w-3xl mx-auto leading-relaxed">
            Le profil DISC est la méthode de référence mondiale pour comprendre les comportements et adapter son management.
            Retail Performer AI l&apos;intègre pour <strong>les vendeurs et les managers</strong> — spécifiquement calibré pour les équipes de vente en magasin.
          </p>
        </div>

        {/* Les 4 profils DISC */}
        <div className="mb-12">
          <h3 className="text-xl font-semibold text-[#334155] text-center mb-8">
            Les 4 profils comportementaux de base
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {DISC_PROFILES.map((profile) => (
              <div
                key={profile.letter}
                onClick={() => setActiveProfile(activeProfile === profile.letter ? null : profile.letter)}
                className={`rounded-2xl border-2 ${profile.border} ${profile.bg} p-6 cursor-pointer transition-all hover:shadow-lg ${activeProfile === profile.letter ? 'shadow-lg scale-[1.02]' : ''}`}
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${profile.color} flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-md`}>
                  {profile.letter}
                </div>
                <h4 className={`text-lg font-bold ${profile.textColor} mb-1`}>Profil {profile.name}</h4>
                <ul className="space-y-1 mb-3">
                  {profile.traits.map((trait) => (
                    <li key={trait} className="text-sm text-[#334155] flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${profile.textColor.replace('text-', 'bg-')}`} />
                      {trait}
                    </li>
                  ))}
                </ul>
                {activeProfile === profile.letter && (
                  <div className={`mt-3 pt-3 border-t ${profile.border}`}>
                    <p className={`text-sm font-semibold ${profile.textColor}`}>💡 {profile.conseil}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-[#64748B] mt-4">Cliquez sur un profil pour voir le conseil management associé</p>
        </div>

        {/* Onglets Vendeur / Manager */}
        <div className="mb-12">
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab('vendeur')}
                className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${activeTab === 'vendeur' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-[#64748B] hover:text-[#334155]'}`}
              >
                🛍️ Profils Vendeur
              </button>
              <button
                onClick={() => setActiveTab('manager')}
                className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${activeTab === 'manager' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-[#64748B] hover:text-[#334155]'}`}
              >
                👔 Profils Manager
              </button>
            </div>
          </div>

          {/* Onglet Vendeur */}
          {activeTab === 'vendeur' && (
            <div>
              <h3 className="text-xl font-semibold text-[#334155] text-center mb-6">
                Les 5 styles de vente en retail
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {SELLER_STYLES.map((style) => (
                  <div key={style.name} className="bg-gray-50 rounded-xl border border-gray-200 p-5 text-center hover:shadow-md transition-all">
                    <div className="text-3xl mb-3">{style.icon}</div>
                    <h4 className="font-bold text-[#334155] mb-1">{style.name}</h4>
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${style.color}`}>Base {style.base}</span>
                    <p className="text-xs text-[#64748B] leading-relaxed">{style.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-sm text-[#64748B] mt-5">
                Chaque vendeur complète un diagnostic de 39 questions — son style, ses 5 piliers de vente, sa motivation.
              </p>
            </div>
          )}

          {/* Onglet Manager */}
          {activeTab === 'manager' && (
            <div>
              <h3 className="text-xl font-semibold text-[#334155] text-center mb-2">
                Les 7 profils de management retail
              </h3>
              <p className="text-center text-sm text-[#64748B] mb-6">
                Chaque manager a un style naturel. L&apos;IA identifie ses forces, ses angles de progression et lui indique comment adapter son coaching à chaque profil vendeur.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                {MANAGER_PROFILES.map((profile) => (
                  <div
                    key={profile.name}
                    onClick={() => setActiveManagerProfile(activeManagerProfile === profile.name ? null : profile.name)}
                    className={`rounded-xl border-2 ${profile.border} bg-white p-5 cursor-pointer transition-all hover:shadow-md ${activeManagerProfile === profile.name ? 'shadow-md scale-[1.01]' : ''}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{profile.icon}</span>
                      <div>
                        <h4 className="font-bold text-[#334155] text-sm">{profile.name}</h4>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${profile.color}`}>Base {profile.base}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed mb-2">{profile.desc}</p>
                    {activeManagerProfile === profile.name && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                        <p className="text-xs text-green-700"><span className="font-semibold">✅ Force :</span> {profile.force}</p>
                        <p className="text-xs text-orange-700"><span className="font-semibold">⚠️ Vigilance :</span> {profile.vigilance}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-center text-sm text-[#64748B]">Cliquez sur un profil pour voir force et point de vigilance</p>
            </div>
          )}
        </div>

        {/* Matrice de compatibilité — teaser */}
        <div className="bg-gradient-to-br from-[#1E40AF]/5 to-[#7C3AED]/10 rounded-2xl border border-[#1E40AF]/20 p-8 mb-10">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-[#1E40AF] mb-2">
              La Matrice de Compatibilité Manager × Vendeur
            </h3>
            <p className="text-[#334155] max-w-2xl mx-auto">
              La vraie question n&apos;est pas seulement &quot;quel est le profil de mon vendeur ?&quot; — c&apos;est <strong>&quot;comment MOI, avec mon profil, je dois adapter mon coaching pour CE vendeur ?&quot;</strong>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {COMPAT_EXAMPLES.map((ex, idx) => (
              <div key={idx} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#1E40AF]">{ex.manager}</span>
                  <span className="text-sm font-semibold text-[#F97316]">{ex.vendeur}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{ex.score}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ex.good ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{ex.label}</span>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">{ex.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center bg-[#1E40AF]/10 rounded-xl p-4">
            <p className="text-sm font-semibold text-[#1E40AF]">
              35 × 35 combinaisons analysées — conseils de communication personnalisés pour chaque duo manager/vendeur
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pt-4">
          <p className="text-[#334155] text-lg font-medium mb-4">
            Découvrez le profil DISC de toute votre équipe en quelques minutes
          </p>
          <button
            onClick={() => navigate('/early-access')}
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
          >
            <Brain className="w-4 h-4" />
            Commencer le diagnostic DISC
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-sm text-[#64748B] mt-3">Essai gratuit 30 jours · Vendeurs et managers inclus</p>
        </div>

      </div>
    </section>
  );
}
