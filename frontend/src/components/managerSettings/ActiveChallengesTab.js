import React from 'react';
import ChallengeCard from './shared/ChallengeCard';

export default function ActiveChallengesTab({
  challenges,
  sellers,
  updatingProgressChallengeId,
  setUpdatingProgressChallengeId,
  challengeProgressValue,
  setChallengeProgressValue,
  handleDeleteChallenge,
  setEditingChallenge,
  setActiveTab,
  storeParam,
  fetchData,
  onUpdate,
}) {
  const today = new Date().toISOString().split('T')[0];
  const activeChallenges = (Array.isArray(challenges) ? challenges : []).filter(
    c => c.end_date >= today && c.status !== 'achieved'
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">📋 Challenges en cours</h3>

        {activeChallenges.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucun challenge en cours</p>
        ) : (
          <div className="space-y-3">
            {activeChallenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                sellers={sellers}
                updatingProgressChallengeId={updatingProgressChallengeId}
                setUpdatingProgressChallengeId={setUpdatingProgressChallengeId}
                challengeProgressValue={challengeProgressValue}
                setChallengeProgressValue={setChallengeProgressValue}
                handleDeleteChallenge={handleDeleteChallenge}
                setEditingChallenge={setEditingChallenge}
                setActiveTab={setActiveTab}
                storeParam={storeParam}
                fetchData={fetchData}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
