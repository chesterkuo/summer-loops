import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../stores/notificationStore';
import NotificationItem from './NotificationItem';

interface NotificationPanelProps {
  onContactClick?: (contactId: string) => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ onContactClick }) => {
  const { t } = useTranslation();
  const {
    pending,
    upcoming,
    done,
    isPanelOpen,
    isLoading,
    closePanel,
    openCreateModal,
    fetchNotifications,
    markDone,
    deleteNotification,
  } = useNotificationStore();

  useEffect(() => {
    if (isPanelOpen) {
      fetchNotifications();
    }
  }, [isPanelOpen, fetchNotifications]);

  if (!isPanelOpen) return null;

  const handleContactClick = (contactId: string) => {
    closePanel();
    onContactClick?.(contactId);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={closePanel}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-background-dark border-l border-gray-800 z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">{t('notifications.title')}</h2>
          <button
            onClick={closePanel}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors"
          >
            <span className="material-symbols-outlined text-gray-400">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Active (past due) */}
              {pending.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    {t('notifications.active')} ({pending.length})
                  </h3>
                  <div className="space-y-2">
                    {pending.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkDone={markDone}
                        onDelete={deleteNotification}
                        onContactClick={handleContactClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming */}
              {upcoming.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">
                    {t('notifications.upcoming')} ({upcoming.length})
                  </h3>
                  <div className="space-y-2">
                    {upcoming.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkDone={markDone}
                        onDelete={deleteNotification}
                        onContactClick={handleContactClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* History */}
              {done.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    {t('notifications.history')} ({done.length})
                  </h3>
                  <div className="space-y-2 opacity-60">
                    {done.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onDelete={deleteNotification}
                        onContactClick={handleContactClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {pending.length === 0 && upcoming.length === 0 && done.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <span className="material-symbols-outlined text-[48px] mb-2">notifications_off</span>
                  <p>{t('notifications.empty')}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer - Add button */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={() => openCreateModal()}
            className="w-full py-3 bg-primary text-black font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            {t('notifications.addReminder')}
          </button>
        </div>
      </div>
    </>
  );
};

export default NotificationPanel;
