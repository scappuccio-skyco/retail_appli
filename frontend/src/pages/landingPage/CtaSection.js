import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function CtaSection() {
  const navigate = useNavigate();

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-900 to-blue-800">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
          Prêt à Transformer Votre Équipe ?
        </h2>
        <p className="text-lg sm:text-xl text-blue-100 mb-8">
          Rejoignez nos pionniers et bénéficiez d'un accompagnement VIP par le fondateur pour vos 14 premiers jours.
        </p>
        <button
          onClick={() => navigate('/early-access')}
          className="px-8 py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-lg font-semibold rounded-xl hover:shadow-2xl transition-all inline-flex items-center gap-2"
        >
          Commencer l'Essai Gratuit
          <ArrowRight className="w-5 h-5" />
        </button>
        <p className="text-blue-100 text-sm mt-4">
          14 jours gratuits • Sans carte bancaire • Résiliation à tout moment
        </p>
      </div>
    </section>
  );
}
