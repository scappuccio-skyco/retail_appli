import React from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';

const AXES = [
  { key: 'score_accueil',        label: 'Accueil',        color: '#6366f1' },
  { key: 'score_decouverte',     label: 'Découverte',     color: '#6366f1' },
  { key: 'score_argumentation',  label: 'Argumentation',  color: '#6366f1' },
  { key: 'score_closing',        label: 'Closing',        color: '#6366f1' },
  { key: 'score_fidelisation',   label: 'Fidélisation',   color: '#6366f1' },
];

export default function SellerCompetencesRadar({ competencesHistory }) {
  const scores = competencesHistory?.[0];
  if (!scores) return null;

  const data = AXES.map(({ key, label }) => ({ competence: label, score: scores[key] || 0 }));
  if (data.every(d => d.score === 0)) return null;

  const avg = Math.round(data.reduce((s, d) => s + d.score, 0) / data.length);

  return (
    <div className="glass-morphism rounded-2xl p-5 mb-6 border border-indigo-100">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🎯</span>
        <h3 className="font-bold text-gray-800">Mon profil de compétences</h3>
        <span className="ml-auto text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
          Score moyen : {avg}/100
        </span>
      </div>
      {scores.days_since_diagnostic > 0 && (
        <p className="text-xs text-gray-400 mb-4 ml-7">
          Basé sur votre diagnostic · mis à jour il y a {scores.days_since_diagnostic} jour{scores.days_since_diagnostic > 1 ? 's' : ''}
        </p>
      )}

      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Radar */}
        <div className="w-full md:w-1/2">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="#c7d2fe" />
              <PolarAngleAxis
                dataKey="competence"
                tick={{ fontSize: 11, fill: '#4338ca', fontWeight: 500 }}
              />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Tooltip
                formatter={(v) => [`${v} / 100`, 'Score']}
                contentStyle={{ backgroundColor: '#eef2ff', border: '1px solid #6366f1', borderRadius: '8px', fontSize: 12 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Barres horizontales */}
        <div className="w-full md:w-1/2 flex flex-col gap-3">
          {data.map(({ competence, score }) => (
            <div key={competence}>
              <div className="flex justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">{competence}</span>
                <span className="text-xs font-bold text-indigo-700">{score}/100</span>
              </div>
              <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${score}%`,
                    background: score >= 70 ? '#6366f1' : score >= 40 ? '#a5b4fc' : '#c7d2fe',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
