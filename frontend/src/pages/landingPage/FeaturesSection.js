import React from 'react';
import { Users, TrendingUp, FileText, Shield } from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      icon: <Users className="w-8 h-8" />,
      color: 'from-[#1E40AF] to-[#1E3A8A]',
      title: 'Intelligence Comportementale (DISC)',
      description: "Ne parlez pas de la même façon à tous vos vendeurs. L'IA identifie le profil de chacun (Rouge, Jaune, Vert, Bleu) et vous dicte les mots exacts pour les motiver et les faire performer. Audit complet du style de leadership pour les managers et diagnostic de performance sur les 5 piliers de la vente pour les vendeurs.",
      impact: 'Pour un management 100% personnalisé.'
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      color: 'from-[#F97316] to-[#EA580C]',
      title: 'Briefs & Rituels d\'Animation',
      description: "Transformez vos KPI en discours mobilisateurs. Chaque matin, générez en 2 secondes le brief parfait : flash-back sur la veille, objectifs du jour et booster de motivation.",
      impact: 'Pour lancer la journée sur une victoire.'
    },
    {
      icon: <FileText className="w-8 h-8" />,
      color: 'from-[#8B5CF6] to-[#7C3AED]',
      title: 'Montée en Compétence',
      description: "L'évaluation n'est plus une corvée annuelle. Suivez la progression de vos équipes semaine après semaine, détectez les besoins de formation et validez les acquis en temps réel.",
      impact: 'Pour transformer vos vendeurs en experts.'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      color: 'from-[#10B981] to-[#00B886]',
      title: 'Sérénité Managériale',
      description: "Soyez sûr de vos écrits. Qu'il s'agisse de recadrer, de féliciter ou d'évaluer, l'IA garantit un ton professionnel, constructif et toujours conforme aux bonnes pratiques RH. Une IA programmée pour être bienveillante, identifiant les axes de progrès sans jamais émettre de jugement négatif.",
      impact: 'Pour manager avec assurance et sécurité.'
    }
  ];

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
            Une Plateforme Complète et Intelligente
          </h2>
          <p className="text-xl text-[#334155] max-w-3xl mx-auto">
            Tout ce dont vous avez besoin pour développer l&apos;excellence de vos équipes commerciales
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => (
            <div key={`feature-${idx}-${feature.title}`} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-[#1E40AF]/20 hover:border-[#F97316]">
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center text-white mb-6`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-[#1E40AF] mb-3">{feature.title}</h3>
              <p className="text-[#334155] mb-3">{feature.description}</p>
              <p className="text-sm font-semibold text-[#F97316] italic">{feature.impact}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
