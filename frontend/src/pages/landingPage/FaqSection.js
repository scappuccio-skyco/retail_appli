import React from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "Comment fonctionne l'essai gratuit ? Y a-t-il un engagement ?",
    answer: "30 jours d'essai gratuit, sans carte bancaire. À la fin, vous choisissez votre formule ou arrêtez simplement. Aucun engagement : vous pouvez changer de formule ou résilier à tout moment depuis votre espace client."
  },
  {
    question: "Combien de personnes peuvent utiliser le service ?",
    answer: "Le service est conçu pour toute votre organisation : le Gérant supervise l'ensemble des magasins, les Managers pilotent leur équipe, et chaque Vendeur accède à son espace personnel. Le nombre d'utilisateurs dépend de votre formule — consultez notre page Tarifs pour les détails."
  },
  {
    question: "Faut-il installer un logiciel ? Est-ce compatible avec ma caisse ou mon ERP ?",
    answer: "Aucune installation requise, c'est 100% web. Si vous disposez d'un logiciel de caisse ou d'un ERP, notre API permet de connecter vos données automatiquement. Sans intégration, chaque vendeur saisit ses chiffres du jour en moins d'une minute depuis son espace."
  },
  {
    question: "Combien de temps avant de voir des résultats ?",
    answer: "Les premiers insights apparaissent dès les premiers jours. Les managers voient immédiatement les KPI de leur équipe et peuvent générer un brief IA dès le lendemain. Des progrès mesurables sur les performances commerciales se constatent généralement après 4 à 6 semaines d'utilisation régulière."
  },
  {
    question: "Quel impact réel sur mes KPI (transformation, panier moyen, etc.) ?",
    answer: "En identifiant quotidiennement les écarts de Panier Moyen ou de Taux de Transformation, l'IA permet de corriger le tir immédiatement. L'objectif est de ne plus attendre la fin du mois pour constater les pertes, mais d'agir jour après jour pour sécuriser votre Chiffre d'Affaires."
  },
  {
    question: "L'IA peut-elle juger mes vendeurs ?",
    answer: "Absolument pas. Retail Performer AI est un outil de développement. Notre IA est configurée pour utiliser un vocabulaire constructif (axes de progrès) et pour valoriser le potentiel de chaque collaborateur, garantissant une acceptation totale par vos équipes."
  },
  {
    question: "Mes données sont-elles sécurisées ? L'IA s'entraîne-t-elle dessus ?",
    answer: "Vos données sont hébergées en Europe (Amsterdam, Pays-Bas), chiffrées et conformes au RGPD. Elles ne sont jamais partagées ni utilisées pour entraîner les modèles d'IA. Pour le coaching, seuls les prénoms sont transmis — les noms de famille sont automatiquement anonymisés."
  },
  {
    question: "Proposez-vous une formation ?",
    answer: "L'outil est conçu pour être Plug & Play. Des guides interactifs sont intégrés dans chaque écran pour accompagner vos équipes pas à pas. Pour les équipes importantes (plan Large Team), nous proposons un onboarding personnalisé."
  },
  {
    question: "Qu'est-ce que le profil DISC et pourquoi l'utiliser en retail ?",
    answer: "Le DISC est la méthode comportementale la plus utilisée au monde (4 profils : Dominant, Influent, Stable, Consciencieux). Retail Performer AI propose deux diagnostics distincts : un diagnostic vendeur (5 styles de vente retail) et un diagnostic manager (7 profils de management). Connaître les deux permet d'adapter les briefs, les feedbacks et les évaluations à chaque individu — et d'utiliser la matrice de compatibilité manager × vendeur pour que chaque manager sache exactement comment coacher chaque vendeur de son équipe."
  },
  {
    question: "Quels KPI retail dois-je suivre pour piloter mon équipe de vendeurs ?",
    answer: "Les 5 KPI essentiels en retail sont : le Taux de Transformation (clients convertis / visiteurs), le Panier Moyen (CA / nombre de transactions), l'Indice de Vente Complémentaire (articles par ticket), le Taux de Fidélisation client et le Chiffre d'Affaires par vendeur. Retail Performer AI centralise et visualise ces indicateurs en temps réel pour chaque vendeur et chaque magasin, avec des alertes automatiques dès qu'un écart est détecté."
  },
  {
    question: "Comment fonctionne la gestion multi-magasins pour un gérant ?",
    answer: "Le gérant dispose d'un espace dédié avec une vue consolidée de tous ses points de vente : KPI agrégés par magasin, comparaison des performances entre boutiques, alertes sur les vendeurs silencieux (sans saisie depuis X jours). Il peut configurer le contexte métier de chaque magasin pour que l'IA personalise les analyses selon la réalité terrain de chaque point de vente. Aucun rapport manuel à demander aux managers."
  },
  {
    question: "Comment le diagnostic DISC améliore-t-il la performance de mes équipes ?",
    answer: "En identifiant le profil comportemental de chaque vendeur ET de chaque manager, l'IA adapte automatiquement le ton et le contenu des briefs, feedbacks et évaluations. La matrice de compatibilité révèle les duos qui fonctionnent bien naturellement et ceux qui nécessitent une adaptation de communication — évitant les frictions inutiles et réduisant le turnover. Un Pilote (manager D) apprendra à ménager son Discret (vendeur S), quand un Coach (manager I/S) sera alerté sur la nécessité de tenir le cap sur les KPI."
  }
];

export default function FaqSection({ openFaq, setOpenFaq }) {
  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
            Questions Fréquentes
          </h2>
          <p className="text-xl text-[#334155]">
            Tout ce que vous devez savoir sur Retail Performer AI
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={`faq-${idx}-${faq.question.substring(0, 20)}`} className="bg-blue-50 rounded-xl border-2 border-[#1E40AF]/20 overflow-hidden hover:border-[#F97316] transition-colors">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#1E40AF]/10 transition-colors"
              >
                <span className="font-semibold text-[#334155]">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-[#F97316] transition-transform ${openFaq === idx ? 'rotate-180' : ''}`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-6 pt-3 pb-4 text-[#334155]">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
