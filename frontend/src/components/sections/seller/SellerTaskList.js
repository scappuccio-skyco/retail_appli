import React from 'react';

/**
 * Liste des tâches du jour du vendeur.
 * Affiche un badge coloré par priorité et gère les actions selon le type de tâche.
 */
export default function SellerTaskList({
  tasks,
  diagnostic,
  onOpenDiagnostic,
  onOpenKpi,
  onOpenCoaching,
  onOpenDebrief,
  onOpenBilan,
  onOpenObjectives,
  onSelectTask,
}) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="bg-green-50/70 rounded px-2 py-0.5 text-center">
        <span className="text-[11px] text-green-800 font-medium whitespace-nowrap inline-flex items-center gap-1">
          <span>🎉</span>
          <span>Bravo ! Toutes tes tâches sont faites.</span>
        </span>
      </div>
    );
  }

  const handleTaskClick = (task) => {
    if (task.type === 'diagnostic') {
      diagnostic ? onOpenDiagnostic() : onOpenDiagnostic(true);
    } else if (task.type === 'kpi') {
      onOpenKpi();
    } else if (task.type === 'challenge') {
      onOpenCoaching();
    } else if (task.type === 'debrief') {
      onOpenDebrief?.();
    } else if (task.type === 'bilan') {
      onOpenBilan?.();
    } else if (task.type === 'objective') {
      onOpenObjectives?.();
    } else {
      onSelectTask(task);
    }
  };

  const priorityBadge = {
    high:      { label: 'Urgent',    className: 'bg-red-100 text-red-700' },
    important: { label: 'Important', className: 'bg-orange-100 text-orange-700' },
  };

  return (
    <div className="flex flex-col gap-1.5">
      {tasks.map((task) => {
        const badge = priorityBadge[task.priority] ?? { label: 'Normal', className: 'bg-yellow-100 text-yellow-700' };
        return (
          <div
            key={task.id}
            className="bg-white rounded-lg p-2 border border-gray-200 hover:shadow-md transition-all cursor-pointer"
            onClick={() => handleTaskClick(task)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xl">{task.icon}</span>
                <h3 className="text-sm font-semibold text-gray-800">{task.title}</h3>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                {badge.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
