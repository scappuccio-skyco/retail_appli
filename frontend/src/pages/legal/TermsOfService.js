import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, CreditCard, Shield, AlertTriangle, Clock, FileCheck } from 'lucide-react';
import LegalPageLayout from './LegalPageLayout';

/**
 * Conditions Générales d'Utilisation et de Vente (CGU/CGV)
 * SKY CO / Retail Performer AI
 */
export default function TermsOfService() {
  return (
    <LegalPageLayout
      title="Conditions Générales d&apos;Utilisation et de Vente"
      subtitle="Dernière mise à jour : Mars 2026"
      icon={Scale}
    >
      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">Service réservé aux professionnels (B2B)</p>
                <p className="text-amber-700 text-sm mt-1">
                  Retail Performer AI est un service destiné exclusivement aux entreprises et professionnels 
                  du secteur Retail. L&apos;utilisation de ce service implique l&apos;acceptation des présentes conditions.
                </p>
              </div>
            </div>
      </div>

      <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4 flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                Article 1 - Objet
              </h2>
              <p className="mb-4">
                Les présentes Conditions Générales d&apos;Utilisation et de Vente (ci-après « CGU/CGV ») 
                régissent l&apos;accès et l&apos;utilisation du service <strong>Retail Performer AI</strong>, 
                édité par la société <strong>SKY CO</strong>.
              </p>
              <p>
                <strong>Objet du service :</strong> Fourniture d&apos;un logiciel SaaS (Software as a Service) 
                d&apos;analyse de performance Retail et de coaching par Intelligence Artificielle, destiné à 
                accompagner les managers et gérants dans le pilotage de leurs équipes de vente.
              </p>
            </section>

            {/* Article 2 - Acceptation */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                Article 2 - Acceptation des conditions
              </h2>
              <p>
                L&apos;inscription au service et son utilisation impliquent l&apos;acceptation pleine et entière 
                des présentes CGU/CGV. L&apos;Utilisateur reconnaît avoir pris connaissance des présentes 
                conditions avant toute souscription.
              </p>
            </section>

            {/* Article 3 - Description du service */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                Article 3 - Description du service
              </h2>
              <p className="mb-6">Retail Performer AI propose un ensemble de fonctionnalités adaptées à chaque rôle au sein de l&apos;organisation Retail :</p>

              <div className="space-y-6">
                {/* Gérant */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                  <h3 className="font-bold text-[#1E40AF] mb-3 flex items-center gap-2">
                    <span className="bg-[#1E40AF] text-white text-xs px-2 py-0.5 rounded-full">Gérant</span>
                    Espace Gérant
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 ml-2 text-gray-700 text-sm">
                    <li>Dashboard de performance global en temps réel</li>
                    <li>Suivi des KPIs de chaque magasin (CA, ventes, évolution par période)</li>
                    <li>Classement et comparaison des performances entre magasins</li>
                    <li>Invitation, gestion et supervision du personnel (managers et vendeurs)</li>
                    <li>Transfert et réorganisation des équipes entre magasins</li>
                    <li>Intégration API pour connecter les logiciels externes (caisse, ERP)</li>
                    <li>Gestion de l&apos;abonnement et de la facturation</li>
                  </ul>
                </div>

                {/* Manager */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
                  <h3 className="font-bold text-[#F97316] mb-3 flex items-center gap-2">
                    <span className="bg-[#F97316] text-white text-xs px-2 py-0.5 rounded-full">Manager</span>
                    Espace Manager
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 ml-2 text-gray-700 text-sm">
                    <li>Tableau de bord des performances de l&apos;équipe en temps réel</li>
                    <li>Suivi des KPIs magasin (CA, ventes, panier moyen, taux de transformation, indice de vente)</li>
                    <li>Définition et suivi des objectifs individuels et collectifs</li>
                    <li>Création et gestion de challenges d&apos;équipe</li>
                    <li>Génération automatisée de briefs matinaux personnalisés par IA</li>
                    <li>Bilan IA de l&apos;équipe (synthèse, points forts, axes d&apos;amélioration, recommandations)</li>
                    <li>Préparation des entretiens annuels des vendeurs avec synthèse IA</li>
                    <li>Coaching relationnel IA adapté au profil DISC de chaque vendeur (situations difficiles et conflits)</li>
                    <li>Diagnostic de profil management (méthodologie DISC)</li>
                  </ul>
                </div>

                {/* Vendeur */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <h3 className="font-bold text-green-700 mb-3 flex items-center gap-2">
                    <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">Vendeur</span>
                    Espace Vendeur
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 ml-2 text-gray-700 text-sm">
                    <li>Tableau de bord des KPIs personnels en temps réel (CA, ventes, panier moyen, taux de transformation)</li>
                    <li>Saisie quotidienne des chiffres de vente</li>
                    <li>Bilan IA des performances par période (journée, semaine, mois, année)</li>
                    <li>Défis quotidiens personnalisés par compétence avec coach IA</li>
                    <li>Analyse IA des ventes conclues (points forts, bonnes pratiques)</li>
                    <li>Analyse IA des opportunités manquées (axes d&apos;amélioration)</li>
                    <li>Suivi des objectifs individuels et challenges assignés par le manager</li>
                    <li>Diagnostic de profil vendeur (style de vente, niveau, motivation, profil DISC)</li>
                    <li>Préparation d&apos;entretien annuel avec bloc-notes et synthèse IA</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Article 4 - Inscription */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                Article 4 - Inscription et accès
              </h2>
              <p className="mb-4">
                L&apos;accès au service nécessite la création d&apos;un compte utilisateur avec une adresse 
                email professionnelle valide. L&apos;Utilisateur s&apos;engage à fournir des informations exactes 
                et à les maintenir à jour.
              </p>
              <p>
                L&apos;Utilisateur est responsable de la confidentialité de ses identifiants de connexion 
                et de toutes les actions effectuées depuis son compte.
              </p>
            </section>

            {/* Article 5 - Tarifs et paiement */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Article 5 - Tarifs et paiement
              </h2>
              <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                <p>
                  <strong>Période d&apos;essai :</strong> Une période d&apos;essai gratuite de 30 jours est proposée 
                  à tout nouvel utilisateur. Aucune carte bancaire n&apos;est requise pour l&apos;essai.
                </p>
                <p>
                  <strong>Tarification :</strong> Le service est facturé selon un modèle d&apos;abonnement 
                  mensuel ou annuel, dont les tarifs sont affichés sur la page Tarifs du site.
                </p>
                <p>
                  <strong>Paiement sécurisé :</strong> Les paiements sont sécurisés par <strong>Stripe</strong>, 
                  prestataire certifié PCI-DSS. SKY CO n&apos;a jamais accès aux données bancaires complètes.
                </p>
                <p>
                  <strong>Renouvellement :</strong> Les abonnements sont renouvelés tacitement à leur échéance, 
                  sauf résiliation préalable par l&apos;Utilisateur depuis son espace client.
                </p>
              </div>
            </section>

            {/* Article 6 - Responsabilité */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Article 6 - Responsabilité et limites
              </h2>
              <div className="bg-blue-50 border-2 border-[#1E40AF]/20 rounded-xl p-6 space-y-4">
                <p>
                  <strong>Obligation de moyens :</strong> SKY CO s&apos;engage à fournir le service avec 
                  diligence et selon les règles de l&apos;art. SKY CO est soumise à une obligation de moyens, 
                  et non de résultat, concernant l&apos;analyse des données et la génération de conseils par IA.
                </p>
                <p>
                  <strong>Limitation de responsabilité :</strong> SKY CO ne peut être tenue responsable :
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 text-gray-600">
                  <li>Des écarts de chiffre d&apos;affaires ou performances commerciales de l&apos;Utilisateur</li>
                  <li>Des décisions managériales prises sur la base des suggestions de l&apos;IA</li>
                  <li>Des conséquences RH (sanctions, conflits) liées à l&apos;interprétation des conseils</li>
                  <li>Des interruptions de service dues à des causes externes (hébergeur, internet)</li>
                </ul>
                <p className="text-sm text-gray-500 mt-4">
                  L&apos;IA est un outil d&apos;aide à la décision. Les conseils générés ne remplacent pas 
                  l&apos;expertise humaine ni les obligations légales en matière de droit du travail.
                </p>
              </div>
            </section>

            {/* Article 7 - Résiliation */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Article 7 - Durée et résiliation
              </h2>
              <p className="mb-4">
                L&apos;abonnement prend effet à la date de souscription et se poursuit pour la durée choisie 
                (mensuelle ou annuelle), renouvelable tacitement.
              </p>
              <p className="mb-4">
                <strong>Résiliation par l&apos;Utilisateur :</strong> L&apos;Utilisateur peut résilier son abonnement 
                à tout moment depuis son espace client. La résiliation prend effet à la fin de la période 
                en cours déjà payée.
              </p>
              <p>
                <strong>Résiliation par SKY CO :</strong> SKY CO se réserve le droit de suspendre ou 
                résilier l&apos;accès au service en cas de non-respect des présentes CGU/CGV, sans préjudice 
                de dommages-intérêts éventuels.
              </p>
            </section>

            {/* Article 8 - Propriété intellectuelle */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                Article 8 - Propriété intellectuelle
              </h2>
              <p>
                L&apos;ensemble des éléments constituant le service (logiciel, algorithmes, interface, 
                contenus générés par l&apos;IA, documentation) sont et restent la propriété exclusive de SKY CO. 
                L&apos;Utilisateur dispose d&apos;un droit d&apos;usage personnel et non-exclusif pour la durée de son abonnement.
              </p>
            </section>

            {/* Article 9 - Données personnelles */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                Article 9 - Protection des données
              </h2>
              <p>
                Le traitement des données personnelles est régi par notre{' '}
                <Link to="/privacy" className="text-[#F97316] hover:underline">
                  Politique de Confidentialité
                </Link>, 
                conforme au Règlement Général sur la Protection des Données (RGPD).
              </p>
            </section>

            {/* Article 10 - Droit applicable */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                Article 10 - Droit applicable et litiges
              </h2>
              <p className="mb-4">
                Les présentes CGU/CGV sont soumises au droit français.
              </p>
              <p>
                En cas de litige, les parties s&apos;engagent à rechercher une solution amiable. À défaut, 
                les tribunaux de Paris seront seuls compétents pour connaître du litige.
              </p>
            </section>

            {/* Article 11 - Coordonnées */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                Article 11 - Contact
              </h2>
              <div className="bg-gray-50 rounded-xl p-6">
                <p><strong>SKY CO</strong></p>
                <p>25 Allée Rose Dieng-Kuntz, 75019 Paris, France</p>
                <p>Email : <a href="mailto:hello@retailperformerai.com" className="text-[#F97316] hover:underline">hello@retailperformerai.com</a></p>
                <p>RCS Paris 889 689 568</p>
            </div>
          </section>
    </LegalPageLayout>
  );
}
