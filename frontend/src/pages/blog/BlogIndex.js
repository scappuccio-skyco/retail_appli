import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import BlogLayout from './BlogLayout';

const ARTICLES = [
  {
    slug: 'profil-disc-retail',
    category: 'Management Retail',
    title: 'Profil DISC en Retail : Comment Manager chaque Vendeur selon son Style Comportemental',
    excerpt: 'Pourquoi certains vendeurs s\'épanouissent avec de l\'autonomie quand d\'autres ont besoin de cadre ? La réponse est dans leur profil DISC.',
    date: '6 avril 2025',
  },
  {
    slug: 'kpi-retail',
    category: 'Performance Retail',
    title: 'KPI Retail : les 7 Indicateurs Clés pour Booster les Performances de votre Équipe',
    excerpt: 'Savoir quoi mesurer, c\'est déjà la moitié du travail. Voici les indicateurs que chaque manager retail devrait suivre chaque semaine.',
    date: '6 avril 2025',
  },
];

export default function BlogIndex() {
  const navigate = useNavigate();

  return (
    <BlogLayout>
      <Helmet>
        <title>Blog Retail & Management | Retail Performer AI</title>
        <meta name="description" content="Conseils et guides pratiques pour manager vos équipes retail : profil DISC, KPI, coaching commercial, intelligence artificielle en point de vente." />
        <link rel="canonical" href="https://retailperformerai.com/blog" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://retailperformerai.com/blog" />
        <meta property="og:title" content="Blog Retail & Management | Retail Performer AI" />
        <meta property="og:description" content="Conseils et guides pratiques pour manager vos équipes retail : profil DISC, KPI, coaching commercial." />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:site_name" content="Retail Performer AI" />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#1E293B] mb-4">
            Blog Retail & Management
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Guides pratiques pour manager vos équipes retail : profil DISC, KPI, coaching commercial et intelligence artificielle en point de vente.
          </p>
        </header>

        {/* Articles */}
        <div className="space-y-6">
          {ARTICLES.map((article) => (
            <Link
              key={article.slug}
              to={`/blog/${article.slug}`}
              className="block bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 hover:border-orange-200 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-block bg-orange-100 text-[#EA580C] text-xs font-semibold px-3 py-1 rounded-full">
                  {article.category}
                </span>
                <span className="text-xs text-slate-400">{article.date}</span>
              </div>
              <h2 className="text-xl font-bold text-[#1E293B] mb-2 group-hover:text-[#F97316] transition-colors">
                {article.title}
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                {article.excerpt}
              </p>
              <span className="inline-block mt-4 text-sm font-semibold text-[#F97316]">
                Lire l'article →
              </span>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-8 text-center">
          <h3 className="text-xl font-bold text-[#1E293B] mb-2">
            Prêt à transformer le management de votre équipe ?
          </h3>
          <p className="text-slate-600 mb-6">
            Retail Performer AI combine KPI retail et diagnostic DISC dans un seul outil. Essai gratuit 30 jours.
          </p>
          <button
            onClick={() => navigate('/early-access')}
            className="inline-block px-8 py-3 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
          >
            Démarrer l'essai gratuit
          </button>
          <p className="text-xs text-slate-400 mt-3">Dès 19€/vendeur/mois · Programme pilote · Tarif bloqué à vie</p>
        </div>

      </div>
    </BlogLayout>
  );
}
