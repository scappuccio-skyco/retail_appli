import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Globe, FileText } from 'lucide-react';
import Logo from '../../components/shared/Logo';

/**
 * Mentions Légales - SKY CO / Retail Performer AI
 * Conforme à la loi française (LCEN)
 */
export default function LegalNotice() {
  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
              <FileText className="w-8 h-8 text-[#1E40AF]" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#1E40AF] mb-2">
              Mentions Légales
            </h1>
            <p className="text-gray-500">Dernière mise à jour : Décembre 2025</p>
          </div>

          {/* Sections */}
          <div className="space-y-10 text-gray-700 leading-relaxed">
            
            {/* Section 1 - Éditeur */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                1. Éditeur du site
              </h2>
              <div className="bg-gray-50 rounded-xl p-6 space-y-3">
                <p><strong>Raison sociale :</strong> SKY CO</p>
                <p><strong>Forme juridique :</strong> Société à Responsabilité Limitée (SARL)</p>
                <p><strong>Siège social :</strong> 25 Allée Rose Dieng-Kuntz, 75019 Paris, France</p>
                <p><strong>Immatriculation :</strong> RCS Paris 889 689 568</p>
                <p><strong>SIRET :</strong> 889 689 568 00059</p>
                <p><strong>Numéro de TVA intracommunautaire :</strong> FR32889689568</p>
                <p><strong>Capital social :</strong> Variable</p>
              </div>
            </section>

            {/* Section 2 - Directeur de publication */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                2. Directeur de la publication
              </h2>
              <div className="bg-gray-50 rounded-xl p-6">
                <p><strong>Nom :</strong> Yann LE GOFF</p>
                <p><strong>Qualité :</strong> Gérant de SKY CO</p>
              </div>
            </section>

            {/* Section 3 - Contact */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                3. Contact
              </h2>
              <div className="bg-gray-50 rounded-xl p-6 space-y-3">
                <p>
                  <strong>Email :</strong>{' '}
                  <a href="mailto:hello@retailperformerai.com" className="text-[#F97316] hover:underline">
                    hello@retailperformerai.com
                  </a>
                </p>
                <p>
                  <strong>Site web :</strong>{' '}
                  <a href="https://www.retailperformerai.com" className="text-[#F97316] hover:underline" target="_blank" rel="noopener noreferrer">
                    www.retailperformerai.com
                  </a>
                </p>
              </div>
            </section>

            {/* Section 4 - Hébergeur */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5" />
                4. Hébergement
              </h2>
              <div className="bg-gray-50 rounded-xl p-6 space-y-3">
                <p><strong>Plateforme d&apos;hébergement :</strong> Emergent (emergent.sh)</p>
                <p><strong>CDN et sécurité :</strong> Cloudflare</p>
                <p><strong>Infrastructure Cloud :</strong> Services Cloud distribués (AWS, GCP)</p>
                <p><strong>Base de données :</strong> MongoDB Atlas</p>
                <p><strong>Localisation des données :</strong> Union Européenne et États-Unis</p>
                <p className="text-sm text-gray-500 mt-2">
                  Les transferts de données hors UE sont encadrés par des Clauses Contractuelles Types (CCT) 
                  conformes au RGPD et aux décisions d&apos;adéquation de la Commission Européenne.
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Pour toute question relative à l&apos;hébergement, contactez{' '}
                <a href="mailto:support@emergent.sh" className="text-[#F97316] hover:underline">support@emergent.sh</a>
              </p>
            </section>

            {/* Section 5 - Propriété intellectuelle */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                5. Propriété intellectuelle
              </h2>
              <p className="mb-4">
                L&apos;ensemble du contenu du site Retail Performer AI (textes, images, graphismes, logo, icônes, 
                logiciels, etc.) est la propriété exclusive de SKY CO ou de ses partenaires, et est protégé 
                par les lois françaises et internationales relatives à la propriété intellectuelle.
              </p>
              <p>
                Toute reproduction, représentation, modification, publication, transmission ou dénaturation, 
                totale ou partielle du site ou de son contenu, par quelque procédé que ce soit, et sur 
                quelque support que ce soit, est interdite sans l&apos;autorisation écrite préalable de SKY CO.
              </p>
            </section>

            {/* Section 6 - Données personnelles */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                6. Protection des données personnelles
              </h2>
              <p>
                Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez 
                d&apos;un droit d&apos;accès, de rectification et de suppression de vos données personnelles. 
                Pour exercer ces droits, contactez-nous à{' '}
                <a href="mailto:hello@retailperformerai.com" className="text-[#F97316] hover:underline">
                  hello@retailperformerai.com
                </a>.
              </p>
              <p className="mt-4">
                Pour plus de détails, consultez notre{' '}
                <Link to="/privacy" className="text-[#F97316] hover:underline">
                  Politique de Confidentialité
                </Link>.
              </p>
            </section>

            {/* Section 7 - Cookies */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                7. Cookies
              </h2>
              <p>
                Le site utilise des cookies techniques nécessaires à son fonctionnement (authentification, 
                préférences utilisateur). En poursuivant votre navigation, vous acceptez l&apos;utilisation 
                de ces cookies conformément à notre politique de confidentialité.
              </p>
            </section>

            {/* Section 8 - Loi applicable */}
            <section>
              <h2 className="text-xl font-bold text-[#1E40AF] mb-4">
                8. Loi applicable et juridiction
              </h2>
              <p>
                Les présentes mentions légales sont soumises au droit français. En cas de litige, 
                et après échec de toute tentative de recherche d&apos;une solution amiable, les tribunaux 
                français seront seuls compétents pour connaître de ce litige.
              </p>
            </section>

          </div>

          {/* Footer links */}
          <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/terms" className="text-gray-500 hover:text-[#1E40AF] transition-colors">
              Conditions Générales
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/privacy" className="text-gray-500 hover:text-[#1E40AF] transition-colors">
              Politique de Confidentialité
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
