import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import BottomNav from '../components/BottomNav';
import CreateNotificationModal from '../components/CreateNotificationModal';
import { ScreenName } from '../App';
import { useContactStore } from '../stores/contactStore';
import { useLocaleStore } from '../stores/localeStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { relationshipsApi, Relationship } from '../services/api';

interface ProfileProps {
  onNavigate: (screen: ScreenName) => void;
}

interface Interaction {
  id: number;
  title: string;
  date: string;
  note: string;
  type: string;
}

const Profile: React.FC<ProfileProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { currentLocale, setLocale, supportedLanguages } = useLocaleStore();
  const { selectedContact, isLoading, setSelectedContact } = useContactStore();
  const { openCreateModal } = useNotificationStore();
  const { user, logout } = useAuthStore();
  const [userRelationship, setUserRelationship] = useState<Relationship | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  // Fetch relationship data for this contact
  useEffect(() => {
    if (selectedContact?.id) {
      relationshipsApi.list(selectedContact.id).then((result) => {
        if (result.data) {
          const directRel = result.data.find((r: any) => r.is_user_relationship === 1);
          setUserRelationship(directRel || null);
        }
      });
    }
  }, [selectedContact?.id]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [newInteraction, setNewInteraction] = useState({ title: t('interaction.coffee'), note: '', type: 'coffee' });
  const [showMenu, setShowMenu] = useState(false);

  const handleAddInteraction = () => {
    if (!newInteraction.title) return;

    const newItem: Interaction = {
      id: Date.now(),
      title: newInteraction.title,
      date: t('interaction.today'),
      note: newInteraction.note,
      type: newInteraction.type
    };

    setInteractions([newItem, ...interactions]);
    setShowAddModal(false);
    setNewInteraction({ title: t('interaction.coffee'), note: '', type: 'coffee' });
  };

  const interactionTypes = [
    { key: 'coffee', label: t('interaction.coffee') },
    { key: 'call', label: t('interaction.call') },
    { key: 'email', label: t('interaction.email') },
    { key: 'meeting', label: t('interaction.meeting') },
  ];

  return (
    <div className="flex flex-col h-full bg-background-dark font-display text-white overflow-hidden relative">
      {/* Analysis Modal */}
      {showAnalysisModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-sm rounded-2xl p-6 border border-white/10 shadow-2xl overflow-y-auto max-h-[85vh] no-scrollbar">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                   <div className="p-1.5 bg-primary/20 rounded-lg">
                      <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
                   </div>
                   {t('analysis.title')}
                </h3>
                <button onClick={() => setShowAnalysisModal(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
                   <span className="material-symbols-outlined">close</span>
                </button>
             </div>

             {/* Connection Score */}
             <div className="mb-8">
                <div className="flex justify-between mb-2 items-end">
                   <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('analysis.connectionStrength')}</span>
                   <span className="text-xl font-bold text-primary">85<span className="text-sm text-gray-500">/100</span></span>
                </div>
                <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                   <div className="h-full bg-gradient-to-r from-primary/40 via-primary to-accent w-[85%] rounded-full shadow-[0_0_10px_rgba(57,224,121,0.3)]"></div>
                </div>
                <p className="mt-2 text-xs text-gray-400">{t('analysis.topPercentage')}</p>
             </div>

             {/* Communication Pattern */}
             <div className="mb-8">
                <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                   <span className="material-symbols-outlined text-gray-400 text-[16px]">bar_chart</span>
                   {t('analysis.interactionRhythm')}
                </h4>
                <div className="flex items-end justify-between h-32 gap-3 px-2">
                    {[35, 45, 25, 65, 85, 50].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end group h-full">
                            <div className="w-full bg-gray-700/50 rounded-t-sm relative group-hover:bg-primary/80 transition-all duration-300" style={{ height: `${h}%` }}>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-dark border border-gray-600 text-[10px] font-bold text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                   {h} {t('analysis.interactions')}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-3 uppercase font-bold px-1 border-t border-white/5 pt-2">
                    <span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span>
                </div>
             </div>

             {/* Insights Grid */}
             <div className="grid grid-cols-1 gap-3 mb-6">
                 <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-accent/30 transition-colors">
                     <div className="flex items-center gap-2 mb-2">
                         <span className="material-symbols-outlined text-accent text-[18px]">light_mode</span>
                         <span className="text-xs font-bold text-white uppercase tracking-wide">{t('analysis.bestTime')}</span>
                     </div>
                     <p className="text-sm text-gray-300 font-medium">{t('analysis.bestTimeValue')}</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-400/30 transition-colors">
                     <div className="flex items-center gap-2 mb-2">
                         <span className="material-symbols-outlined text-blue-400 text-[18px]">forum</span>
                         <span className="text-xs font-bold text-white uppercase tracking-wide">{t('analysis.preferredChannel')}</span>
                     </div>
                     <p className="text-sm text-gray-300 font-medium">
                       {t('analysis.preferredChannelValue', { defaultValue: 'Responds fastest to email for work topics.' }).split('<1>')[0]}
                       <span className="text-white font-bold">{t('interaction.email')}</span>
                       {t('analysis.preferredChannelValue', { defaultValue: 'Responds fastest to email for work topics.' }).split('</1>')[1] || ''}
                     </p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-pink-400/30 transition-colors">
                     <div className="flex items-center gap-2 mb-2">
                         <span className="material-symbols-outlined text-pink-400 text-[18px]">topic</span>
                         <span className="text-xs font-bold text-white uppercase tracking-wide">{t('analysis.topTopics')}</span>
                     </div>
                     <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 rounded-md bg-pink-500/10 text-pink-300 text-[10px] font-bold border border-pink-500/20">FinTech</span>
                        <span className="px-2 py-1 rounded-md bg-pink-500/10 text-pink-300 text-[10px] font-bold border border-pink-500/20">AI Ethics</span>
                        <span className="px-2 py-1 rounded-md bg-pink-500/10 text-pink-300 text-[10px] font-bold border border-pink-500/20">Hiring</span>
                     </div>
                 </div>
             </div>

             <button onClick={() => setShowAnalysisModal(false)} className="w-full py-3.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-sm transition-colors shadow-lg">
                {t('analysis.closeAnalysis')}
             </button>
          </div>
        </div>
      )}

      {/* Add Interaction Modal */}
      {showAddModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-sm rounded-2xl p-5 border border-white/10 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">{t('interaction.logInteraction')}</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('interaction.interactionType')}</label>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                   {interactionTypes.map(type => (
                     <button
                       key={type.key}
                       onClick={() => setNewInteraction({ ...newInteraction, type: type.key, title: type.label })}
                       className={`px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap transition-colors ${newInteraction.type === type.key ? 'bg-primary text-black border-primary' : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-500'}`}
                     >
                       {type.label}
                     </button>
                   ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('interaction.titleLabel')}</label>
                <input
                  value={newInteraction.title}
                  onChange={e => setNewInteraction({ ...newInteraction, title: e.target.value })}
                  className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                  placeholder={t('interaction.titlePlaceholder')}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('interaction.notes')}</label>
                <textarea
                  value={newInteraction.note}
                  onChange={e => setNewInteraction({ ...newInteraction, note: e.target.value })}
                  className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none h-24 resize-none transition-colors"
                  placeholder={t('interaction.notesPlaceholder')}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddInteraction}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-black text-sm font-bold transition-colors shadow-lg shadow-primary/20"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Jump & Options Menu */}
      {showMenu && (
        <>
          <div className="absolute inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={() => setShowMenu(false)}></div>
          <div className="absolute top-16 right-4 w-72 bg-[#2C3435] border border-gray-700 rounded-2xl shadow-2xl p-4 z-50 animate-fade-in origin-top-right">
             <div className="mb-5">
               <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t('menu.quickJump')}</h4>
               <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => { onNavigate('dashboard'); setShowMenu(false); }} className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors gap-1 group border border-white/5 hover:border-white/10">
                    <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">home</span>
                    <span className="text-[10px] font-medium text-gray-300">{t('menu.home')}</span>
                 </button>
                 <button onClick={() => { onNavigate('map'); setShowMenu(false); }} className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors gap-1 group border border-white/5 hover:border-white/10">
                    <span className="material-symbols-outlined text-blue-400 group-hover:scale-110 transition-transform">hub</span>
                    <span className="text-[10px] font-medium text-gray-300">{t('menu.map')}</span>
                 </button>
                 <button onClick={() => { onNavigate('scan'); setShowMenu(false); }} className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors gap-1 group border border-white/5 hover:border-white/10">
                    <span className="material-symbols-outlined text-purple-400 group-hover:scale-110 transition-transform">qr_code_scanner</span>
                    <span className="text-[10px] font-medium text-gray-300">{t('menu.scan')}</span>
                 </button>
                 <button onClick={() => { onNavigate('path'); setShowMenu(false); }} className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors gap-1 group border border-white/5 hover:border-white/10">
                    <span className="material-symbols-outlined text-accent group-hover:scale-110 transition-transform">insights</span>
                    <span className="text-[10px] font-medium text-gray-300">{t('menu.path')}</span>
                 </button>
               </div>
             </div>

             <div>
               <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t('menu.language')}</h4>
               <div className="grid grid-cols-3 gap-2">
                 {supportedLanguages.map((lang) => (
                    <button
                       key={lang.code}
                       onClick={() => setLocale(lang.code)}
                       className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all active:scale-95 ${currentLocale === lang.code ? 'bg-primary/20 border-primary text-white shadow-sm' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:text-gray-200'}`}
                    >
                       <span className="text-xl mb-1">{lang.flag}</span>
                       <span className="text-[10px] font-bold">{lang.label}</span>
                    </button>
                 ))}
               </div>
             </div>
          </div>
        </>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-background-dark/95 backdrop-blur-sm p-4 border-b border-transparent">
        <button onClick={() => onNavigate('dashboard')} className="flex size-10 items-center justify-center rounded-full bg-surface-card shadow-sm hover:bg-gray-700 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
        </button>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`flex size-10 items-center justify-center rounded-full transition-colors ${showMenu ? 'bg-white/10 text-white' : 'hover:bg-white/10'}`}
        >
          <span className="material-symbols-outlined text-[24px]">more_horiz</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 px-4 pt-2 flex flex-col gap-6 animate-fade-in">
        {/* Loading / No Contact State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {!isLoading && !selectedContact && (
          <>
            {/* User Profile Hero */}
            <div className="flex flex-col items-center mt-2">
              <div className="relative group">
                <div
                  className="bg-center bg-no-repeat bg-cover rounded-full h-28 w-28 shadow-lg border-2 border-background-dark mb-4 flex items-center justify-center bg-gradient-to-br from-primary/30 to-accent/30"
                  style={{ backgroundImage: user?.avatarUrl ? `url("${user.avatarUrl}")` : undefined }}
                >
                  {!user?.avatarUrl && (
                    <span className="text-4xl font-bold text-white">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-4 right-0 bg-primary rounded-full p-1.5 border-4 border-background-dark shadow-sm">
                  <span className="material-symbols-outlined text-black text-[16px] font-bold">verified</span>
                </div>
              </div>
              <div className="flex flex-col items-center text-center gap-1">
                <h1 className="text-white text-2xl font-extrabold tracking-tight">{user?.name || t('profile.myProfile')}</h1>
                <p className="text-text-muted text-sm font-medium">{user?.email || ''}</p>
              </div>
            </div>

            {/* Language Settings */}
            <div className="bg-surface-card p-5 rounded-2xl shadow-sm border border-white/5">
              <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest mb-4">{t('menu.language')}</h3>
              <div className="grid grid-cols-3 gap-2">
                {supportedLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLocale(lang.code)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all active:scale-95 ${currentLocale === lang.code ? 'bg-primary/20 border-primary text-white shadow-sm' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:text-gray-200'}`}
                  >
                    <span className="text-xl mb-1">{lang.flag}</span>
                    <span className="text-[10px] font-bold">{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Account Actions */}
            <div className="bg-surface-card p-5 rounded-2xl shadow-sm border border-white/5">
              <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest mb-4">{t('profile.account')}</h3>
              <div className="space-y-2">
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-primary">home</span>
                  <span className="text-sm font-medium text-white">{t('nav.home')}</span>
                </button>
                <button
                  onClick={() => onNavigate('map')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-blue-400">hub</span>
                  <span className="text-sm font-medium text-white">{t('nav.network')}</span>
                </button>
                <button
                  onClick={() => {
                    logout();
                    onNavigate('dashboard');
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-900/20 hover:bg-red-900/30 transition-colors text-left border border-red-800/30"
                >
                  <span className="material-symbols-outlined text-red-400">logout</span>
                  <span className="text-sm font-medium text-red-400">{t('common.exit')}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {selectedContact && (
        <>
        {/* Profile Hero */}
        <div className="flex flex-col items-center mt-2">
          <div className="relative group">
            <div
              className="bg-center bg-no-repeat bg-cover rounded-full h-28 w-28 shadow-lg border-2 border-background-dark mb-4 flex items-center justify-center bg-gradient-to-br from-primary/30 to-accent/30"
            >
              <span className="text-4xl font-bold text-white">
                {selectedContact.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            {(userRelationship?.strength || 0) >= 7 && (
              <div className="absolute bottom-4 right-0 bg-accent rounded-full p-1.5 border-4 border-background-dark shadow-sm">
                <span className="material-symbols-outlined text-black text-[16px] font-bold">bolt</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center text-center gap-1">
            <h1 className="text-white text-2xl font-extrabold tracking-tight">{selectedContact.name}</h1>
            <p className="text-text-muted text-sm font-medium">
              {selectedContact.title ? `${selectedContact.title}` : ''}
              {selectedContact.title && selectedContact.company ? ' at ' : ''}
              {selectedContact.company ? (
                <button
                  onClick={() => onNavigate('company')}
                  className="text-primary hover:underline"
                >
                  {selectedContact.company}
                </button>
              ) : ''}
              {!selectedContact.title && !selectedContact.company && 'No title or company'}
            </p>
            {selectedContact.department && (
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <span className="material-symbols-outlined text-[14px]">corporate_fare</span>
                <span>{selectedContact.department}</span>
              </div>
            )}
            {selectedContact.email && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                <span className="material-symbols-outlined text-[14px]">mail</span>
                <span>{selectedContact.email}</span>
              </div>
            )}
            {selectedContact.phone && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <span className="material-symbols-outlined text-[14px]">phone</span>
                <span>{selectedContact.phone}</span>
              </div>
            )}
          </div>
          {/* Strength Meter */}
          <div className="mt-5 flex flex-col items-center gap-2">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((level) => {
                const strength = userRelationship?.strength || 0;
                const strengthLevel = Math.ceil(strength / 2);
                return (
                  <div
                    key={level}
                    className={`h-2 w-8 rounded-full ${level <= strengthLevel ? 'bg-accent shadow-[0_0_8px_rgba(252,217,107,0.4)]' : 'bg-white/10'}`}
                  />
                );
              })}
            </div>
            <span className="text-[10px] font-bold text-accent tracking-widest uppercase mt-1">
              {!userRelationship ? t('profile.noRelationshipData') :
               userRelationship.strength >= 8 ? t('profile.strongConnection') :
               userRelationship.strength >= 5 ? t('profile.goodConnection') :
               userRelationship.strength >= 3 ? t('profile.casualConnection') : t('profile.weakConnection')}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => onNavigate('path')} className="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-primary text-black font-bold text-sm shadow-sm hover:bg-primary-dark active:scale-[0.98] transition-all">
            <span className="material-symbols-outlined text-[20px]">alt_route</span>
            {t('profile.findPath')}
          </button>
          <button onClick={() => onNavigate('draft')} className="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-[#2C3435] border border-gray-700 text-white font-bold text-sm hover:bg-gray-700 active:scale-[0.98] transition-all">
            <span className="material-symbols-outlined text-[20px]">edit_note</span>
            {t('profile.draftIntro')}
          </button>
          <button onClick={() => openCreateModal(selectedContact?.id)} className="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-[#2C3435] border border-gray-700 text-white font-bold text-sm hover:bg-gray-700 active:scale-[0.98] transition-all">
            <span className="material-symbols-outlined text-[20px]">alarm_add</span>
            {t('profile.setReminder')}
          </button>
        </div>

        {/* Insight Card */}
        <div className="bg-surface-card p-6 rounded-2xl shadow-sm border border-white/5 relative overflow-hidden group min-h-[180px] flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                <span className="material-symbols-outlined icon-filled text-[18px]">auto_awesome</span>
                </div>
                <h3 className="font-bold text-white text-base">{t('profile.warmlyInsight')}</h3>
            </div>
            <p className="text-gray-300 text-[15px] leading-relaxed">
                {selectedContact.ai_summary || selectedContact.notes || t('profile.defaultInsight', { name: selectedContact.name })}
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              <span>{t('common.privateToYou')}</span>
            </div>
            <button
              onClick={() => setShowAnalysisModal(true)}
              className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
                {t('profile.viewAnalysis')}
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* History */}
        <div className="bg-surface-card p-5 rounded-2xl shadow-sm border border-white/5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest">{t('profile.recentInteractions')}</h3>
            <button
              onClick={() => setShowAddModal(true)}
              className="size-8 flex items-center justify-center rounded-full hover:bg-white/10 text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>
          <div className="relative pl-1 space-y-6">
            {interactions.length > 0 && (
              <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-white/5"></div>
            )}

            {interactions.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <span className="material-symbols-outlined text-3xl mb-2 block">history</span>
                <p className="text-sm">{t('profile.noInteractions')}</p>
                <p className="text-xs mt-1">{t('profile.tapToLog')}</p>
              </div>
            ) : (
              interactions.map((interaction) => (
                <div key={interaction.id} className="relative flex gap-4 items-start group animate-fade-in">
                  <div
                    className={`relative z-10 flex size-4 shrink-0 items-center justify-center rounded-full border-[2px] mt-1 shadow-sm
                      ${interaction.type === 'coffee' || interaction.type === 'call'
                        ? 'bg-background-dark border-primary shadow-primary/20'
                        : 'bg-surface-card border-gray-600'}`}
                  ></div>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-white text-sm">{interaction.title}</span>
                      <span className="text-xs text-gray-400">{interaction.date}</span>
                    </div>
                    {interaction.note && (
                      <p className="text-xs text-gray-400 line-clamp-1">{interaction.note}</p>
                    )}
                  </div>
                </div>
              ))
            )}

          </div>
        </div>
        </>
        )}
      </div>
      <BottomNav active="profile" onNavigate={onNavigate} />

      {/* Create Notification Modal */}
      <CreateNotificationModal />
    </div>
  );
};

export default Profile;
