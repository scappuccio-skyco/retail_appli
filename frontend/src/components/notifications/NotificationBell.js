import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';

const TYPE_ICONS = {
  kpi_saved:     '✅',
  silent_seller: '⚠️',
  objective_reached: '🏆',
  default:       '🔔',
};

const TYPE_COLORS = {
  kpi_saved:     'bg-green-50 border-green-200',
  silent_seller: 'bg-orange-50 border-orange-200',
  objective_reached: 'bg-yellow-50 border-yellow-200',
  default:       'bg-blue-50 border-blue-200',
};

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export default function NotificationBell({ notifications, unreadCount, onMarkRead, onMarkAllRead }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Fermer le panel si clic en dehors
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Cloche */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
        title="Notifications"
      >
        <Bell className="w-4 h-4 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-11 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="font-bold text-gray-800 text-sm">
              Notifications {unreadCount > 0 && <span className="text-red-500">({unreadCount})</span>}
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => { onMarkAllRead(); }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  title="Tout marquer comme lu"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Tout lire
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Liste */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-gray-400 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Aucune notification
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.read) onMarkRead(n.id); }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex gap-3 items-start ${!n.read ? 'bg-blue-50/40' : ''}`}
                >
                  {/* Icône type */}
                  <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border text-sm ${TYPE_COLORS[n.type] || TYPE_COLORS.default}`}>
                    {TYPE_ICONS[n.type] || TYPE_ICONS.default}
                  </div>
                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold text-gray-900 leading-tight ${!n.read ? 'font-bold' : ''}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {/* Point non lu */}
                  {!n.read && (
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
