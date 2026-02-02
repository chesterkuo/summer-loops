import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Notification } from '../services/api';

interface NotificationItemProps {
  notification: Notification;
  onMarkDone?: (id: string) => void;
  onDelete?: (id: string) => void;
  onContactClick?: (contactId: string) => void;
  onSyncCalendar?: (id: string) => Promise<void>;
  onUnsyncCalendar?: (id: string) => Promise<void>;
  calendarConnected?: boolean;
}

function formatRelativeTime(dateStr: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    // Past
    const absMins = Math.abs(diffMins);
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);

    if (absMins < 60) return t('notifications.timeAgo', { time: `${absMins}m` });
    if (absHours < 24) return t('notifications.timeAgo', { time: `${absHours}h` });
    return t('notifications.timeAgo', { time: `${absDays}d` });
  } else {
    // Future
    if (diffMins < 60) return t('notifications.inTime', { time: `${diffMins}m` });
    if (diffHours < 24) return t('notifications.inTime', { time: `${diffHours}h` });
    return t('notifications.inTime', { time: `${diffDays}d` });
  }
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkDone,
  onDelete,
  onContactClick,
  onSyncCalendar,
  onUnsyncCalendar,
  calendarConnected,
}) => {
  const { t } = useTranslation();
  const [isSyncingCal, setIsSyncingCal] = useState(false);
  const isPending = notification.status === 'pending';
  const isPastDue = isPending && new Date(notification.remindAt) <= new Date();

  const handleCalendarToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSyncingCal(true);
    try {
      if (notification.googleEventId) {
        await onUnsyncCalendar?.(notification.id);
      } else {
        await onSyncCalendar?.(notification.id);
      }
    } finally {
      setIsSyncingCal(false);
    }
  };

  return (
    <div className={`p-3 rounded-lg ${isPastDue ? 'bg-red-900/20 border border-red-800/50' : 'bg-surface-card'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {notification.contactName ? (
            <button
              onClick={() => notification.contactId && onContactClick?.(notification.contactId)}
              className="text-sm font-medium text-primary hover:underline truncate block"
            >
              {notification.contactName}
            </button>
          ) : (
            <span className="text-sm font-medium text-gray-400">{t('notifications.general')}</span>
          )}
          {notification.note && (
            <p className="text-sm text-gray-300 mt-1 line-clamp-2">{notification.note}</p>
          )}
          <p className={`text-xs mt-1 ${isPastDue ? 'text-red-400' : 'text-gray-500'}`}>
            {formatRelativeTime(notification.remindAt, t)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {calendarConnected && (
            <button
              onClick={handleCalendarToggle}
              disabled={isSyncingCal}
              className={`p-1.5 rounded-full transition-colors disabled:opacity-50 ${
                notification.googleEventId
                  ? 'text-blue-400 hover:bg-blue-500/20'
                  : 'text-gray-500 hover:bg-white/10 hover:text-blue-400'
              }`}
              title={notification.googleEventId ? 'Remove from Google Calendar' : 'Add to Google Calendar'}
            >
              <span className={`material-symbols-outlined text-[16px] ${isSyncingCal ? 'animate-spin' : ''}`}>
                {isSyncingCal ? 'progress_activity' : notification.googleEventId ? 'event_available' : 'calendar_add_on'}
              </span>
            </button>
          )}
          {isPending && onMarkDone && (
            <button
              onClick={() => onMarkDone(notification.id)}
              className="p-1.5 rounded-full hover:bg-green-900/30 text-green-500 transition-colors"
              title={t('notifications.markDone')}
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(notification.id)}
              className="p-1.5 rounded-full hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-colors"
              title={t('notifications.delete')}
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
