import React from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "Comment fonctionne l'essai gratuit de 30 jours ?",
    answer: "Aucune carte bancaire requise. Vous testez toutes les fonctionnalités pendant 30 jours. À la fin de l'essai, vous choisissez votre formule ou arrêtez simplement — sans engagement."
  },
  {
    question: "Combien de personnes peuvent utiliser le service ?",
    answer: "Le service est conçu pour toute votre organisation : le Gérant supervise l'ensemble des magasins, les Managers pilotent leur équipe, et chaque Vendeur accède à son espace personnel. Le nombre d'utilisateurs dépend de votre formule — consultez notre page Tarifs pour les détails."
  },
  {
    question: "Faut-il installer un logiciel ?",
    answer: "Non, Retail Performer AI est 100% web. Accessible depuis n'importe quel navigateur, sur ordinateur, tablette ou smartphone."
  },
  {
    question: "Est-ce compatible avec mon logiciel de caisse ou mon ERP ?",
    answer: "Oui. Retail Performer AI propose une intégration API pour connecter vos logiciels existants (caisse, ERP, etc.) et alimenter automatiquement les données de vente. Sans intégration, les vendeurs saisissent eux-mêmes leurs chiffres quotidiens en moins d'une minute."
  },
  {
    question: "Qui saisit les données de vente ?",
    answer: "Par défaut, chaque vendeur saisit ses propres chiffres quotidiens (CA, ventes, clients) directement depuis son espace personnel — cela prend moins d'une minute. Si vous connectez votre logiciel de caisse via l'API, la saisie est automatique."
  },
  {
    question: "Combien de temps avant de voir des résultats ?",
    answer: "Les premiers insights apparaissent dès les premiers jours de saisie. Les managers voient immédiatement les KPI de leur équipe et peuvent générer un brief IA dès le lendemain. Les progrès mesurables sur les performances commerciales se constatent généralement sur 4 à 6 semaines d'utilisation régulière."
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
    question: "Mes données sont-elles sécurisées ?",
    answer: "Oui, toutes vos données sont hébergées en Europe (Amsterdam, Pays-Bas), chiffrées et conformes au RGPD. Nous ne partageons jamais vos données avec des tiers. Pour l'IA de coaching, seuls les prénoms sont transmis (les noms de famille sont automatiquement anonymisés)."
  },
  {
    question: "L'IA utilise-t-elle mes données commerciales pour s'entraîner ?",
    answer: "Non. Vos données sont anonymisées avant toute analyse et ne sont jamais utilisées pour entraîner les modèles d'IA. Une fois l'analyse générée, les données brutes ne sont pas conservées par notre fournisseur IA."
  },
  {
    question: "Puis-je changer de formule ou résilier à tout moment ?",
    answer: "Oui, sans engagement. Vous pouvez changer de formule ou résilier à tout moment depuis votre espace client. Le changement de formule est instantané, la résiliation prend effet à la fin de la période en cours déjà payée."
  },
  {
    question: "Proposez-vous une formation ?",
    answer: "L'outil est conçu pour être Plug & Play. Des guides interactifs sont intégrés directement dans chaque écran pour vous accompagner pas à pas. Pour les équipes importantes (plan Large Team), nous proposons un onboarding personnalisé."
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
                <div className="px-6 pb-4 text-[#334155]">
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
