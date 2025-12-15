import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Database, Eye, UserCheck, Server, Mail } from 'lucide-react';
import Logo from '../../components/shared/Logo';

/**
 * Politique de Confidentialité - RGPD
 * SKY CO / Retail Performer AI
 */
export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo variant="header" size="sm" />
          <Link 
            to="/" 
            className="flex items-center gap-2 text-gray-600 hover:text-[#1E40AF] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-12">
          {/* Title */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1E40AF]/10 rounded-full mb-4">
              <Lock className="w-8 h-8 text-[#1E40AF]" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#1E40AF] mb-2">
              Politique de Confidentialité
            </h1>
            <p className="text-gray-500">Conforme au RGPD - Dernière mise à jour : Décembre 2025</p>
          </div>

          {/* RGPD Badge */}
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 mb-10">
            <div className="flex items-start gap-3">
              <Lock className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800">Conformité RGPD</p>
                <p className="text-green-700 text-sm mt-1">
                  Cette politique respecte le Règlement Général sur la Protection des Données (RGPD) 
                  de l&apos;Union Européenne. Vos droits sont protégés et vous pouvez les exercer à tout moment.
                </p>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-10 text-gray-700 leading-relaxed">
            
            {/* Section 1 - Responsable du traitement */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4 flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                1. Responsable du traitement
              </h2>
              <div className="bg-gray-50 rounded-xl p-6 space-y-3">
                <p><strong>Société :</strong> SKY CO (SARL)</p>
                <p><strong>Responsables :</strong> Sébastien CAPPUCCIO et Yann LE GOFF (Co-gérants)</p>
                <p><strong>Siège social :</strong> 25 Allée Rose Dieng-Kuntz, 75019 Paris, France</p>
                <p><strong>Contact DPO :</strong> <a href="mailto:hello@retailperformerai.com" className="text-[#F97316] hover:underline">hello@retailperformerai.com</a></p>
              </div>
            </section>

            {/* Section 2 - Données collectées */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4 flex items-center gap-2">
                <Database className="w-5 h-5" />
                2. Données collectées
              </h2>
              <p className="mb-4">Nous collectons les catégories de données suivantes :</p>
              
              <div className="space-y-4">
                {/* Données d'identité */}
                <div className="bg-gray-50 rounded-xl p-5">
                  <h3 className="font-semibold text-[#1E40AF] mb-2">Données d&apos;identification</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-2">
                    <li>Nom et prénom des managers et vendeurs</li>
                    <li>Adresse email professionnelle</li>
                    <li>Rôle dans l&apos;organisation (Gérant, Manager, Vendeur)</li>
                    <li>Nom du magasin ou de l&apos;entreprise</li>
                  </ul>
                </div>

                {/* Données de performance */}
                <div className="bg-gray-50 rounded-xl p-5">
                  <h3 className="font-semibold text-[#1E40AF] mb-2">Données de performance</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-2">
                    <li>Chiffre d&apos;affaires journalier (CA)</li>
                    <li>Nombre de ventes et d&apos;articles vendus</li>
                    <li>Indicateurs clés de performance (KPI) : panier moyen, taux de transformation, indice de vente</li>
                    <li>Historique des performances</li>
                  </ul>
                </div>

                {/* Données techniques */}
                <div className="bg-gray-50 rounded-xl p-5">
                  <h3 className="font-semibold text-[#1E40AF] mb-2">Données techniques</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-2">
                    <li>Logs de connexion et d&apos;utilisation</li>
                    <li>Adresse IP (anonymisée)</li>
                    <li>Type de navigateur et appareil</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3 - Finalités */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                3. Finalités du traitement
              </h2>
              <p className="mb-4">
                Les données collectées sont utilisées <strong>exclusivement</strong> pour les finalités suivantes :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Fonctionnement du service :</strong> Affichage des tableaux de bord, génération des briefs matinaux, analyse des performances</li>
                <li><strong>Intelligence Artificielle :</strong> Génération de conseils personnalisés, analyses de tendances, coaching individuel</li>
                <li><strong>Gestion de compte :</strong> Authentification, gestion des abonnements, support client</li>
                <li><strong>Amélioration du service :</strong> Statistiques anonymisées d&apos;utilisation</li>
              </ul>
              
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mt-6">
                <p className="text-amber-800 font-semibold">
                  ⚠️ Vos données ne sont JAMAIS revendues à des tiers.
                </p>
                <p className="text-amber-700 text-sm mt-1">
                  SKY CO s&apos;engage à ne jamais commercialiser, louer ou partager vos données personnelles 
                  à des fins publicitaires ou de prospection commerciale.
                </p>
              </div>
            </section>

            {/* Section 4 - Sous-traitants */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4 flex items-center gap-2">
                <Server className="w-5 h-5" />
                4. Sous-traitants et transferts de données
              </h2>
              <p className="mb-4">
                Pour assurer le fonctionnement du service, nous faisons appel aux sous-traitants suivants :
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#1E40AF]/10">
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-[#1E40AF]">Sous-traitant</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-[#1E40AF]">Usage</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-[#1E40AF]">Localisation</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 px-4 py-3 font-medium">MongoDB Atlas</td>
                      <td className="border border-gray-200 px-4 py-3">Stockage des données</td>
                      <td className="border border-gray-200 px-4 py-3">UE (Ireland) / US</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 px-4 py-3 font-medium">OpenAI (GPT-4o)</td>
                      <td className="border border-gray-200 px-4 py-3">Traitement IA (analyses, conseils)</td>
                      <td className="border border-gray-200 px-4 py-3">US (DPA signé)</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 px-4 py-3 font-medium">Stripe</td>
                      <td className="border border-gray-200 px-4 py-3">Traitement des paiements</td>
                      <td className="border border-gray-200 px-4 py-3">UE / US (PCI-DSS)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 px-4 py-3 font-medium">Brevo (ex-Sendinblue)</td>
                      <td className="border border-gray-200 px-4 py-3">Emails transactionnels</td>
                      <td className="border border-gray-200 px-4 py-3">UE (France)</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 px-4 py-3 font-medium">Emergent / Cloudflare</td>
                      <td className="border border-gray-200 px-4 py-3">Hébergement et CDN</td>
                      <td className="border border-gray-200 px-4 py-3">UE / US</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <p className="text-sm text-gray-500 mt-4">
                Tous nos sous-traitants sont liés par des clauses contractuelles types (CCT) ou des 
                Data Processing Agreements (DPA) conformes au RGPD.
              </p>
            </section>

            {/* Section 5 - Durée de conservation */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                5. Durée de conservation
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Données de compte :</strong> Conservées pendant la durée de l&apos;abonnement + 3 ans après la résiliation</li>
                <li><strong>Données de performance :</strong> Conservées pendant la durée de l&apos;abonnement + 1 an</li>
                <li><strong>Logs techniques :</strong> 12 mois maximum</li>
                <li><strong>Données de facturation :</strong> 10 ans (obligation légale)</li>
              </ul>
            </section>

            {/* Section 6 - Vos droits */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                6. Vos droits RGPD
              </h2>
              <p className="mb-4">
                Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="font-semibold text-[#1E40AF]">✓ Droit d&apos;accès</p>
                  <p className="text-sm text-gray-600">Obtenir une copie de vos données</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="font-semibold text-[#1E40AF]">✓ Droit de rectification</p>
                  <p className="text-sm text-gray-600">Corriger des données inexactes</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="font-semibold text-[#1E40AF]">✓ Droit à l&apos;effacement</p>
                  <p className="text-sm text-gray-600">Demander la suppression de vos données</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="font-semibold text-[#1E40AF]">✓ Droit à la portabilité</p>
                  <p className="text-sm text-gray-600">Récupérer vos données dans un format standard</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="font-semibold text-[#1E40AF]">✓ Droit d&apos;opposition</p>
                  <p className="text-sm text-gray-600">S&apos;opposer à certains traitements</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="font-semibold text-[#1E40AF]">✓ Droit à la limitation</p>
                  <p className="text-sm text-gray-600">Limiter le traitement de vos données</p>
                </div>
              </div>

              <div className="bg-[#1E40AF]/10 rounded-xl p-6 mt-6">
                <p className="font-semibold text-[#1E40AF] mb-2">Pour exercer vos droits :</p>
                <p className="text-gray-700">
                  Envoyez un email à{' '}
                  <a href="mailto:hello@retailperformerai.com" className="text-[#F97316] hover:underline font-medium">
                    hello@retailperformerai.com
                  </a>{' '}
                  en précisant votre demande et en joignant une copie de votre pièce d&apos;identité.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Nous nous engageons à répondre dans un délai d&apos;un mois.
                </p>
              </div>
            </section>

            {/* Section 7 - Réclamation */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                7. Réclamation auprès de la CNIL
              </h2>
              <p>
                Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une 
                réclamation auprès de la Commission Nationale de l&apos;Informatique et des Libertés (CNIL) :
              </p>
              <p className="mt-2">
                <a 
                  href="https://www.cnil.fr/fr/plaintes" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#F97316] hover:underline"
                >
                  www.cnil.fr/fr/plaintes
                </a>
              </p>
            </section>

            {/* Section 8 - Cookies */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                8. Cookies
              </h2>
              <p className="mb-4">
                Le site utilise des cookies strictement nécessaires au fonctionnement du service :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Cookies d&apos;authentification :</strong> Maintien de la session utilisateur</li>
                <li><strong>Cookies de préférences :</strong> Mémorisation des paramètres d&apos;affichage</li>
              </ul>
              <p className="mt-4 text-sm text-gray-500">
                Aucun cookie publicitaire ou de tracking tiers n&apos;est utilisé.
              </p>
            </section>

            {/* Section 9 - Modifications */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                9. Modifications de la politique
              </h2>
              <p>
                Cette politique peut être mise à jour pour refléter les évolutions légales ou 
                fonctionnelles du service. En cas de modification substantielle, les utilisateurs 
                seront informés par email ou notification dans l&apos;application.
              </p>
            </section>

          </div>

          {/* Footer links */}
          <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/legal" className="text-gray-500 hover:text-[#1E40AF] transition-colors">
              Mentions Légales
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/terms" className="text-gray-500 hover:text-[#1E40AF] transition-colors">
              Conditions Générales
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/" className="text-gray-500 hover:text-[#1E40AF] transition-colors">
              Accueil
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
