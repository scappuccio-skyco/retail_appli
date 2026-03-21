import React from 'react';
import useManagerSettingsPage from './managerSettings/useManagerSettingsPage';
import KpiConfigSection from './managerSettings/KpiConfigSection';
import ObjectivesSection from './managerSettings/ObjectivesSection';
import ChallengesSection from './managerSettings/ChallengesSection';

export default function ManagerSettings() {
  const {
    loading, kpiConfig, objectives, challenges,
    newObjective, setNewObjective,
    newChallenge, setNewChallenge,
    updateKPIConfig, createObjective, createChallenge,
  } = useManagerSettingsPage();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-medium text-gray-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => globalThis.history.back()}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="text-xl">←</span>
            <span>Retour</span>
          </button>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="text-2xl font-bold text-gray-800">Configuration & Challenges</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <KpiConfigSection kpiConfig={kpiConfig} onUpdate={updateKPIConfig} />
        <ObjectivesSection
          objectives={objectives}
          newObjective={newObjective}
          setNewObjective={setNewObjective}
          onSubmit={createObjective}
        />
        <ChallengesSection
          challenges={challenges}
          newChallenge={newChallenge}
          setNewChallenge={setNewChallenge}
          onSubmit={createChallenge}
        />
      </div>
    </div>
  );
}
