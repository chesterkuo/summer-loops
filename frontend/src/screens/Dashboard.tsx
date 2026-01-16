import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import BottomNav from '../components/BottomNav';
import NotificationPanel from '../components/NotificationPanel';
import CreateNotificationModal from '../components/CreateNotificationModal';
import { ScreenName } from '../App';
import { useAuthStore } from '../stores/authStore';
import { useContactStore } from '../stores/contactStore';
import { useNotificationStore } from '../stores/notificationStore';
import { Contact } from '../services/api';

interface DashboardProps {
  onNavigate: (screen: ScreenName) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showAllOpportunities, setShowAllOpportunities] = useState(false);
  const [noteText, setNoteText] = useState('');

  const { user, isAuthenticated, isLoading: authLoading, demoLogin, initialize } = useAuthStore();
  const { contacts, graphData, fetchContacts, fetchGraph, parseText, createContact, isLoading, setSelectedContact } = useContactStore();
  const { activeCount, openPanel, fetchNotifications } = useNotificationStore();

  // Initialize auth and fetch data on mount
  useEffect(() => {
    const init = async () => {
      await initialize();
      // Auto-login with demo if not authenticated
      const store = useAuthStore.getState();
      if (!store.isAuthenticated) {
        await demoLogin();
      }
    };
    init();
  }, []);

  // Fetch contacts and notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchContacts();
      fetchGraph();
      fetchNotifications();
    }
  }, [isAuthenticated]);

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;

    // Parse the note with AI and create contact if applicable
    const parsed = await parseText(noteText);
    if (parsed?.name) {
      await createContact(parsed);
      await fetchContacts();
    }
    setShowNoteModal(false);
    setNoteText('');
  };

  // Get avatar URL for a contact
  const getAvatarUrl = (contact: Contact, index: number) => {
    const colors = ['39E079', 'FCD96B', '3B82F6', 'EF4444', '8B5CF6'];
    const color = colors[index % colors.length];
    const initials = contact.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=${color}&color=fff&size=128`;
  };

  // Get relationship degree badge based on graph data
  const getDegreeBadge = (contact: Contact) => {
    // Find the contact in graph nodes to get actual degree
    const node = graphData?.nodes.find(n => n.id === contact.id);
    const degree = node?.degree || 2; // Default to 2nd degree if not found

    if (degree === 1) {
      return { label: t('dashboard.1stDegree'), bgClass: 'bg-green-900/30', textClass: 'text-green-400' };
    } else if (degree === 2) {
      return { label: t('dashboard.2ndDegree'), bgClass: 'bg-yellow-900/30', textClass: 'text-yellow-500' };
    }
    return { label: t('dashboard.nthDegree', { n: degree }), bgClass: 'bg-gray-900/30', textClass: 'text-gray-400' };
  };

  if (authLoading) {
    return (
      <div className="flex flex-col h-full bg-background-dark items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="text-text-muted mt-4">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background-dark font-display text-white overflow-hidden relative">
      {/* All Opportunities Modal */}
      {showAllOpportunities && (
        <div className="absolute inset-0 z-50 bg-background-dark flex flex-col animate-fade-in">
          <header className="flex items-center justify-between p-6 border-b border-white/5 bg-background-dark/95 backdrop-blur-sm sticky top-0 z-10">
            <h2 className="text-xl font-bold text-white">{t('dashboard.allContacts')}</h2>
            <button
              onClick={() => setShowAllOpportunities(false)}
              className="size-10 flex items-center justify-center rounded-full bg-surface-card hover:bg-gray-700 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-24">
            {contacts.map((contact, index) => (
              <div
                key={contact.id}
                onClick={() => { setShowAllOpportunities(false); onNavigate('path'); }}
                className="group relative flex flex-col gap-4 rounded-2xl bg-surface-card p-5 transition-all hover:bg-gray-800 cursor-pointer border border-transparent hover:border-primary/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div
                      className="w-12 h-12 rounded-xl bg-gray-700 bg-center bg-cover"
                      style={{ backgroundImage: `url("${getAvatarUrl(contact, index)}")` }}
                    />
                    <div>
                      <h4 className="font-bold text-white text-base">{contact.name}</h4>
                      <p className="text-xs text-text-muted font-medium">
                        {contact.title || 'Professional'} {contact.company ? `@ ${contact.company}` : ''}
                      </p>
                      {(() => {
                        const badge = getDegreeBadge(contact);
                        return (
                          <div className={`mt-1 inline-flex items-center rounded-md ${badge.bgClass} px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.textClass}`}>
                            {badge.label}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Note Modal */}
      {showNoteModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-sm rounded-2xl p-5 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">{t('quickNote.title')}</h3>
              <button onClick={() => setShowNoteModal(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-xs text-text-muted mb-3">
              {t('quickNote.description')}
            </p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t('quickNote.placeholder')}
              className="w-full bg-black/20 border border-gray-700 rounded-xl p-4 text-white text-sm focus:border-primary outline-none h-32 resize-none mb-4 placeholder:text-gray-500 transition-colors"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowNoteModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveNote}
                disabled={isLoading}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-black text-sm font-bold transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isLoading ? t('quickNote.processing') : t('quickNote.saveWithAI')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-6 pb-2">
        <div className="flex items-center gap-3">
          <div className="relative cursor-pointer" onClick={() => { setSelectedContact(null); onNavigate('profile'); }}>
            <div
              className="bg-center bg-no-repeat bg-cover rounded-full w-10 h-10 ring-2 ring-surface-card shadow-sm"
              style={{ backgroundImage: `url("${user?.avatarUrl || 'https://ui-avatars.com/api/?name=User&background=39E079&color=fff'}")` }}
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary border-2 border-background-dark rounded-full"></div>
          </div>
          <div>
            <h2 className="text-white text-lg font-bold leading-tight">
              {t('dashboard.greeting')}, {user?.name?.split(' ')[0] || 'User'}
            </h2>
            <p className="text-text-muted text-xs font-medium">{t('dashboard.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={openPanel}
          className="relative flex w-10 h-10 items-center justify-center rounded-full bg-surface-card hover:bg-gray-700 transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">notifications</span>
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          )}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
        {/* Search Bar */}
        <div className="px-6 py-4">
          <div
            onClick={() => onNavigate('search')}
            className="relative flex items-center h-14 w-full rounded-2xl bg-surface-card shadow-lg transition-all cursor-pointer hover:bg-gray-800 group"
          >
            <div className="absolute left-4 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined icon-filled">search</span>
            </div>
            <span className="h-full w-full rounded-2xl border-none bg-transparent pl-12 pr-12 text-base font-medium text-text-muted/60 flex items-center">
              {t('dashboard.searchPlaceholder')}
            </span>
            <div className="absolute right-4 flex items-center justify-center text-text-muted" onClick={(e) => { e.stopPropagation(); onNavigate('voice'); }}>
              <span className="material-symbols-outlined">mic</span>
            </div>
          </div>
        </div>

        {/* Network Stats */}
        <div className="px-6 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col justify-between rounded-2xl bg-surface-card p-5 border border-transparent hover:border-primary/10 transition-colors">
              <div className="flex items-start justify-between">
                <div className="rounded-full bg-background-dark p-2 text-primary">
                  <span className="material-symbols-outlined text-[20px]">groups</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  {contacts.length > 0 ? '+' + Math.min(contacts.length, 12) : '0'}%
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold tracking-tight text-white">{contacts.length}</p>
                <p className="text-xs font-medium text-text-muted">{t('dashboard.totalContacts')}</p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl bg-surface-card p-5 border border-transparent hover:border-primary/10 transition-colors">
              <div className="flex items-start justify-between">
                <div className="rounded-full bg-background-dark p-2 text-accent/90">
                  <span className="material-symbols-outlined text-[20px] text-yellow-500">handshake</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                  <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                  {graphData?.edges.length || 0}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold tracking-tight text-white">{graphData?.edges.length || 0}</p>
                <p className="text-xs font-medium text-text-muted">{t('dashboard.relationships')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-4">
          <div className="flex gap-4">
            <button onClick={() => onNavigate('scan')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-dark text-background-dark h-12 px-4 shadow-glow transition-all active:scale-95">
              <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
              <span className="text-sm font-bold">{t('dashboard.scanCard')}</span>
            </button>
            <button onClick={() => setShowNoteModal(true)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-card border border-gray-700 text-white h-12 px-4 hover:bg-gray-800 transition-all active:scale-95">
              <span className="material-symbols-outlined text-[20px] text-primary">edit_note</span>
              <span className="text-sm font-bold">{t('dashboard.quickNote')}</span>
            </button>
          </div>
        </div>

        {/* Contacts List */}
        <div className="px-6 pt-2 pb-2 flex items-center justify-between">
          <h3 className="text-white text-lg font-bold leading-tight">{t('dashboard.yourContacts')}</h3>
          <button
            onClick={() => setShowAllOpportunities(true)}
            className="text-primary text-sm font-semibold hover:underline"
          >
            {t('dashboard.viewAll')}
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 pb-6">
          {isLoading && contacts.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
              {t('dashboard.loadingContacts')}
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <span className="material-symbols-outlined text-4xl mb-2">person_add</span>
              <p>{t('dashboard.noContacts')}</p>
            </div>
          ) : (
            contacts.slice(0, 4).map((contact, index) => (
              <div
                key={contact.id}
                onClick={() => { setSelectedContact(contact); onNavigate('profile'); }}
                className="group relative flex flex-col gap-4 rounded-2xl bg-surface-card p-5 transition-all hover:bg-gray-800 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div
                      className="w-12 h-12 rounded-xl bg-gray-700 bg-center bg-cover"
                      style={{ backgroundImage: `url("${getAvatarUrl(contact, index)}")` }}
                    />
                    <div>
                      <h4 className="font-bold text-white text-base">{contact.name}</h4>
                      <p className="text-xs text-text-muted font-medium">
                        {contact.title || 'Professional'} {contact.company ? `@ ${contact.company}` : ''}
                      </p>
                      {(() => {
                        const badge = getDegreeBadge(contact);
                        return (
                          <div className={`mt-1 inline-flex items-center rounded-md ${badge.bgClass} px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.textClass}`}>
                            {badge.label}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">more_horiz</span>
                  </button>
                </div>

                {/* Path Visual for first contact */}
                {index === 0 && graphData && graphData.edges.length > 0 && (
                  <div className="relative mt-1 rounded-xl bg-background-dark p-3">
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex flex-col items-center gap-1 w-16 text-center">
                        <div className="w-8 h-8 rounded-full border-2 border-surface-card bg-cover bg-center"
                          style={{ backgroundImage: `url("${user?.avatarUrl || 'https://ui-avatars.com/api/?name=You&background=39E079&color=fff'}")` }}
                        />
                        <span className="text-[10px] font-bold text-text-muted">{t('common.you')}</span>
                      </div>
                      <div className="h-0.5 flex-1 bg-primary/30 mx-1 relative">
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-[8px] text-background-dark font-bold">check</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1 w-16 text-center">
                        <div className="w-8 h-8 rounded-full border-2 border-surface-card bg-cover bg-center"
                          style={{ backgroundImage: `url("${getAvatarUrl(contact, 0)}")` }}
                        />
                        <span className="text-[10px] font-bold text-white">{contact.name.split(' ')[0]}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <BottomNav active="home" onNavigate={onNavigate} />

      {/* Notification Panel */}
      <NotificationPanel
        onContactClick={(contactId) => {
          const contact = contacts.find(c => c.id === contactId);
          if (contact) {
            setSelectedContact(contact);
            onNavigate('profile');
          }
        }}
      />

      {/* Create Notification Modal */}
      <CreateNotificationModal />
    </div>
  );
};

export default Dashboard;
