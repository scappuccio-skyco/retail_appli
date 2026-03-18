import React from 'react';

/**
 * Liste des tâches à faire pour le manager.
 * Gère les actions selon le type de tâche.
 */
export default function ManagerTaskList({
  tasks,
  onViewSellerNotes,     // (seller_id, seller_name) → ouvre fiche vendeur onglet Notes
  onViewSellerDetail,    // (seller_id) → ouvre fiche vendeur
  onCreateGoal,          // () → ouvre modal objectif/challenge
  onSendReminder,        // (seller_id, seller_name) → envoie manager_request
}) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="bg-green-50/70 rounded px-2 py-0.5 text-center">
        <span className="text-[11px] text-green-800 font-medium whitespace-nowrap inline-flex items-center gap-1">
          <span>🎉</span>
          <span>Toutes vos tâches sont à jour.</span>
        </span>
      </div>
    );
  }

  const priorityBadge = {
    important: { label: 'Important', className: 'bg-orange-100 text-orange-700' },
    normal:    { label: 'Normal',    className: 'bg-yellow-100 text-yellow-700' },
  };

  const handleClick = (task) => {
    switch (task.type) {
      case 'notes':
        onViewSellerNotes?.(task.seller_id, task.seller_name);
        break;
      case 'missing_diagnostic':
        onViewSellerDetail?.(task.seller_id);
        break;
      case 'silent_seller':
        onSendReminder?.(task.seller_id, task.seller_name);
        break;
      case 'objective_expiring':
      case 'challenge_ended':
      case 'no_upcoming_goals':
        onCreateGoal?.();
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {tasks.map((task) => {
        const badge = priorityBadge[task.priority] ?? priorityBadge.normal;
        return (
          <div
            key={task.id}
            className="bg-white rounded-lg p-2 border border-gray-200 hover:shadow-md transition-all cursor-pointer"
            onClick={() => handleClick(task)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xl flex-shrink-0">{task.icon}</span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 truncate">{task.title}</h3>
                  {task.description && (
                    <p className="text-xs text-gray-500 truncate">{task.description}</p>
                  )}
                </div>
              </div>
              <span className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                {badge.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
