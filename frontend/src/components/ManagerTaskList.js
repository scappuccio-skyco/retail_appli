import React, { useState } from 'react';

const SNOOZE_KEY = 'manager_snoozed_tasks';
const SNOOZE_DAYS = 7;

function getSnoozed() {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}');
  } catch { return {}; }
}

function snoozeTask(taskId) {
  const snoozed = getSnoozed();
  snoozed[taskId] = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozed));
}

export default function ManagerTaskList({ tasks, onViewSellerNotes, onViewSellerDetail, onCreateGoal, onSendReminder }) {
  const [snoozedIds, setSnoozedIds] = useState(() => {
    const s = getSnoozed();
    return new Set(Object.keys(s).filter(id => s[id] > Date.now()));
  });

  const handleSnooze = (e, taskId) => {
    e.stopPropagation();
    snoozeTask(taskId);
    setSnoozedIds(prev => new Set([...prev, taskId]));
  };

  const handleClick = (task) => {
    switch (task.type) {
      case 'notes':
        onViewSellerNotes?.(task.seller_id, task.seller_name);
        break;
      case 'missing_diagnostic':
        if (task.seller_ids?.length === 1) onViewSellerDetail?.(task.seller_ids[0]);
        break;
      case 'silent_seller':
        onSendReminder?.(task.seller_id, task.seller_name);
        break;
      case 'objective_expiring':
      case 'no_upcoming_goals':
        onCreateGoal?.(task.objective_id);
        break;
      default:
        break;
    }
  };

  const visibleTasks = (tasks || []).filter(t => !snoozedIds.has(t.id));
  const actionTasks = visibleTasks.filter(t => t.category === 'action');
  const infoTasks = visibleTasks.filter(t => t.category !== 'action');

  if (visibleTasks.length === 0) {
    return (
      <div className="bg-green-50/70 rounded px-2 py-0.5 text-center">
        <span className="text-[11px] text-green-800 font-medium whitespace-nowrap inline-flex items-center gap-1">
          <span>🎉</span>
          <span>Toutes vos tâches sont à jour.</span>
        </span>
      </div>
    );
  }

  const renderTask = (task, zoneStyle) => (
    <div
      key={task.id}
      className={`rounded-lg p-2 border transition-all cursor-pointer group ${zoneStyle}`}
      onClick={() => handleClick(task)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="text-xl flex-shrink-0 mt-0.5">{task.icon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 leading-tight">{task.title}</h3>
            {task.description && (
              <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={(e) => handleSnooze(e, task.id)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1"
          title="Masquer 7 jours"
        >✕</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {actionTasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide px-1">⚡ À faire</p>
          {actionTasks.map(t => renderTask(t, 'bg-white border-orange-200 hover:border-orange-400 hover:shadow-md'))}
        </div>
      )}
      {infoTasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide px-1">ℹ️ À surveiller</p>
          {infoTasks.map(t => renderTask(t, 'bg-blue-50/60 border-blue-100 hover:border-blue-300 hover:shadow-sm'))}
        </div>
      )}
    </div>
  );
}
