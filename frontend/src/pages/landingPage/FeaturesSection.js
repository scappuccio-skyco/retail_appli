import React from 'react';
import { Users, TrendingUp, FileText, Shield, LayoutDashboard } from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      icon: <LayoutDashboard className="w-8 h-8" />,
      color: 'from-[#7C3AED] to-[#6D28D9]',
      title: 'Pilotage Multi-Magasins',
      description: "Vue consolidée de tous vos points de vente en un tableau de bord. KPI retail agrégés, comparaison entre magasins, alertes automatiques sur les vendeurs silencieux. Vous savez ce qui se passe partout, sans y être.",
      impact: 'Pour les gérants qui pilotent à distance.',
      badge: 'Gérant'
    },
    {
      icon: <Users className="w-8 h-8" />,
      color: 'from-[#1E40AF] to-[#1E3A8A]',
      title: 'Intelligence Comportementale DISC',
      description: "Diagnostic DISC pour les vendeurs (5 styles) et les managers (7 profils). L'IA révèle les forces, les angles de progression et surtout — comment chaque manager doit adapter son coaching à chaque vendeur. La compatibilité DISC manager × vendeur, intégrée nativement.",
      impact: 'Pour un management 100% personnalisé.',
      badge: 'Manager & Vendeur'
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      color: 'from-[#F97316] to-[#EA580C]',
      title: 'Briefs & Rituels d\'Animation',
      description: "Transformez vos KPI retail en discours mobilisateurs. Chaque matin, générez en 2 secondes le brief parfait adapté au profil DISC de chaque vendeur : flash-back sur la veille, objectifs du jour et booster de motivation.",
      impact: 'Pour lancer la journée sur une victoire.',
      badge: 'Manager'
    },
    {
      icon: <FileText className="w-8 h-8" />,
      color: 'from-[#8B5CF6] to-[#7C3AED]',
      title: 'Montée en Compétence',
      description: "L'évaluation n'est plus une corvée annuelle. Suivez la progression de vos équipes semaine après semaine, détectez les besoins de formation et validez les acquis en temps réel.",
      impact: 'Pour transformer vos vendeurs en experts.',
      badge: 'Manager'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      color: 'from-[#10B981] to-[#00B886]',
      title: 'Sérénité Managériale',
      description: "Soyez sûr de vos écrits. Qu'il s'agisse de recadrer, de féliciter ou d'évaluer, l'IA garantit un ton professionnel, constructif et toujours conforme aux bonnes pratiques RH.",
      impact: 'Pour manager avec assurance et sécurité.',
      badge: 'Manager'
    },
  ];

  const badgeColors = {
    'Gérant': 'bg-purple-100 text-purple-700',
    'Manager': 'bg-blue-100 text-blue-700',
    'Manager & Vendeur': 'bg-orange-100 text-orange-700',
  };

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
            Une Plateforme Complète et Intelligente
          </h2>
          <p className="text-xl text-[#334155] max-w-3xl mx-auto">
            Du pilotage multi-magasins à l&apos;intelligence comportementale DISC — tout ce qu&apos;il faut pour développer l&apos;excellence de vos équipes retail
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-[#1E40AF]/20 hover:border-[#F97316] flex flex-col">
              <div className="flex items-start justify-between mb-6">
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center text-white`}>
                  {feature.icon}
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeColors[feature.badge]}`}>
                  {feature.badge}
                </span>
              </div>
              <h3 className="text-xl font-bold text-[#1E40AF] mb-3">{feature.title}</h3>
              <p className="text-[#334155] mb-3 flex-1">{feature.description}</p>
              <p className="text-sm font-semibold text-[#F97316] italic">{feature.impact}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
