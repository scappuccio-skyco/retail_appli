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
      subtitle="Dernière mise à jour : Décembre 2025"
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
              <p className="mb-4">Retail Performer AI propose les fonctionnalités suivantes :</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Tableau de bord de suivi des KPI vendeurs en temps réel</li>
                <li>Génération automatisée de briefs matinaux personnalisés</li>
                <li>Analyse de performance par Intelligence Artificielle (GPT-4o)</li>
                <li>Coaching individuel basé sur le profil psychologique (méthodologie DISC)</li>
                <li>Gestion des équipes (invitation, suivi, suspension)</li>
                <li>Historique des performances et des consultations IA</li>
              </ul>
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
                  <strong>Période d&apos;essai :</strong> Une période d&apos;essai gratuite de 14 jours est proposée 
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
