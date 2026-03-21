import React from 'react';
import { Award, TrendingUp, BarChart3 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { LABEL_DECOUVERTE } from '../../lib/constants';
import { renderMarkdownBold } from '../../utils/markdownRenderer';

export default function CompetencesTab({ diagnostic, seller, radarData, hasAnyScore, currentCompetences, evolutionData }) {
  return (
    <>
      {/* Diagnostic profile card */}
      {diagnostic ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-800">Profil de vente</h2>
          </div>
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-3 border border-indigo-100/60">
            {diagnostic.style ? (
              <>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                    <p className="text-[10px] text-gray-400 mb-0.5">Style</p>
                    <p className="text-xs font-bold text-gray-800">{diagnostic.style}</p>
                  </div>
                  <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                    <p className="text-[10px] text-gray-400 mb-0.5">Niveau</p>
                    <p className="text-xs font-bold text-gray-800">{diagnostic.level || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                    <p className="text-[10px] text-gray-400 mb-0.5">Motivation</p>
                    <p className="text-xs font-bold text-gray-800">{diagnostic.motivation || 'N/A'}</p>
                  </div>
                </div>
                {diagnostic.ai_profile_summary && (
                  <div className="bg-white rounded-xl p-3 shadow-sm">
                    <p className="text-xs text-gray-700 leading-relaxed">{renderMarkdownBold(diagnostic.ai_profile_summary)}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                  <p className="text-[10px] text-gray-400 mb-0.5">Score</p>
                  <p className="text-sm font-bold text-gray-800">
                    {diagnostic.score != null ? `${Number(diagnostic.score).toFixed(1)} / 10` : 'N/A'}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                  <p className="text-[10px] text-gray-400 mb-0.5">Profil</p>
                  <p className="text-xs font-bold text-gray-800">
                    {diagnostic.profile === 'communicant_naturel' ? 'Communicant Naturel' :
                     diagnostic.profile === 'excellence_commerciale' ? 'Excellence Commerciale' :
                     diagnostic.profile === 'potentiel_developper' ? 'Potentiel à Développer' :
                     diagnostic.profile === 'equilibre' ? 'Profil Équilibré' :
                     diagnostic.profile || 'Non défini'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800">Diagnostic non complété</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              {seller.name} n'a pas encore effectué son diagnostic. Il doit se connecter à son compte pour le compléter.
            </p>
          </div>
        </div>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-gray-800">Compétences actuelles</h3>
          </div>
          {hasAnyScore ? (
            <ResponsiveContainer width="100%" height={210}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748b', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                <Radar name="Score" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[210px] flex flex-col items-center justify-center text-gray-400 gap-2">
              <BarChart3 className="w-8 h-8 opacity-30" />
              <p className="text-xs text-center">
                {currentCompetences
                  ? 'Aucune compétence évaluée — scores à 0'
                  : 'Diagnostic non complété'}
              </p>
            </div>
          )}
        </div>

        {/* Evolution */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-gray-800">Évolution du score global</h3>
            </div>
            {evolutionData.length > 0 && (
              <span className="text-xs font-bold text-blue-600">
                {evolutionData[evolutionData.length - 1]['Score Global']}/50
                {evolutionData.length > 1 && (
                  <span className={`ml-1 text-[10px] font-medium ${
                    evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global'] >= 0
                      ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    ({evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global'] >= 0 ? '+' : ''}
                    {(evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global']).toFixed(1)})
                  </span>
                )}
              </span>
            )}
          </div>
          {evolutionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={evolutionData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="fullDate" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis domain={[0, 50]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="Score Global" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[210px] flex flex-col items-center justify-center text-gray-400 gap-2">
              <TrendingUp className="w-8 h-8 opacity-30" />
              <p className="text-xs">Pas encore d'historique</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
