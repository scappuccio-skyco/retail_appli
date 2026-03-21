import React from 'react';
import { Check, Users, Calendar } from 'lucide-react';

export default function ContactSection({ setShowDemoModal }) {
  return (
    <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
            Contactez-Nous
          </h2>
          <p className="text-xl text-[#334155]">
            Une question ? Notre équipe vous répond en moins de 24h
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Demo Request Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border-2 border-[#1E40AF]/20">
            <h3 className="text-2xl font-bold text-[#1E40AF] mb-2">Réservez Votre Démonstration</h3>
            <p className="text-sm text-[#334155] mb-6">
              Découvrez comment Retail Performer AI peut transformer votre équipe en 30 minutes
            </p>

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[#1E40AF]" />
                </div>
                <div>
                  <p className="font-semibold text-[#1E40AF]">Démonstration personnalisée</p>
                  <p className="text-sm text-[#334155]">30 minutes avec un expert</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-[#1E40AF]">Sans engagement</p>
                  <p className="text-sm text-[#334155]">Découvrez toutes les fonctionnalités</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#F97316]" />
                </div>
                <div>
                  <p className="font-semibold text-[#1E40AF]">Adapté à vos besoins</p>
                  <p className="text-sm text-[#334155]">Conseils personnalisés pour votre équipe</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowDemoModal(true)}
              className="w-full py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 text-lg"
            >
              <Calendar className="w-5 h-5" />
              Je veux une démonstration
            </button>
            <p className="text-xs text-center text-[#64748B] mt-3">
              Réponse garantie sous 24h ouvrées
            </p>
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-8 border-2 border-[#F97316]">
              <h3 className="text-xl font-bold text-[#1E40AF] mb-4">Informations de Contact</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-[#334155] mb-1">Email</p>
                  <a href="mailto:hello@retailperformerai.com" className="text-[#EA580C] font-semibold hover:underline">
                    hello@retailperformerai.com
                  </a>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#334155] mb-1">Adresse</p>
                  <p className="text-slate-800">
                    25 allée Rose Dieng-Kuntz<br />
                    75019 Paris, France
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-2xl p-8 border-2 border-[#1E40AF]/30">
              <h3 className="text-xl font-bold text-[#1E40AF] mb-4">Horaires</h3>
              <p className="text-slate-800">
                Lundi - Vendredi : 9h - 18h<br />
                Samedi - Dimanche : Fermé
              </p>
              <p className="text-sm text-[#334155] mt-4">
                Réponse sous 24h ouvrées
              </p>
            </div>

            <div className="rounded-2xl overflow-hidden shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80"
                alt="Service client professionnel et accueillant"
                className="w-full h-48 object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
