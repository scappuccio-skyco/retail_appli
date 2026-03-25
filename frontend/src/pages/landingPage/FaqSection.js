import React from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "Comment fonctionne l'essai gratuit de 30 jours ?",
    answer: "Aucune carte bancaire requise. Vous testez toutes les fonctionnalités pendant 30 jours. À la fin de l'essai, vous choisissez votre formule ou arrêtez simplement."
  },
  {
    question: "Y a-t-il un engagement ? Puis-je résilier à tout moment ?",
    answer: "Aucun engagement. Vous pouvez résilier votre abonnement à tout moment depuis votre espace client. La résiliation prend effet à la fin de la période en cours déjà payée, sans frais ni pénalité."
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
    answer: "Oui. Retail Performer AI propose une intégration API pour connecter vos logiciels existants (caisse, ERP, etc.) et alimenter automatiquement les données de vente. Cette fonctionnalité est disponible dès la création de votre compte Gérant."
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
    answer: "Oui, toutes vos données sont hébergées en France, chiffrées et conformes au RGPD. Nous ne partageons jamais vos données avec des tiers. Pour l'IA de coaching, seuls les prénoms sont transmis (les noms de famille sont automatiquement anonymisés)."
  },
  {
    question: "L'IA conserve-t-elle mes données commerciales ?",
    answer: "Non. Nous utilisons des technologies LLM (Large Language Models) via des protocoles sécurisés 'Entreprise'. Vos données sont anonymisées avant traitement et ne sont jamais utilisées pour entraîner les modèles publics. Une fois l'analyse générée, les données brutes ne sont pas conservées par le fournisseur d'IA."
  },
  {
    question: "Puis-je changer de formule à tout moment ?",
    answer: "Oui, absolument. Vous pouvez passer d'une formule à l'autre à tout moment selon l'évolution de votre équipe. Le changement est instantané."
  },
  {
    question: "Proposez-vous une formation ?",
    answer: "L'outil est conçu pour être 'Plug & Play'. Pas besoin de formation lourde : des guides interactifs sont intégrés directement dans chaque écran pour vous accompagner pas à pas. Pour les réseaux (Plans Large Team), nous proposons un onboarding personnalisé."
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
