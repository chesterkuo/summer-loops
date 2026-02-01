import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import BottomNav from '../components/BottomNav';
import CreateNotificationModal from '../components/CreateNotificationModal';
import { ScreenName } from '../App';
import { useContactStore } from '../stores/contactStore';
import { useLocaleStore } from '../stores/localeStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { relationshipsApi, interactionsApi, aiApi, messagingApi, Relationship, Interaction, Contact } from '../services/api';

interface ProfileProps {
  onNavigate: (screen: ScreenName) => void;
}

const Profile: React.FC<ProfileProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { currentLocale, setLocale, supportedLanguages } = useLocaleStore();
  const { selectedContact, isLoading, setSelectedContact, updateContact } = useContactStore();
  const { openCreateModal } = useNotificationStore();
  const { user, logout, updateUser, deleteAccount } = useAuthStore();
  const [userRelationship, setUserRelationship] = useState<Relationship | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(false);
  const [isSavingInteraction, setIsSavingInteraction] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isInsightExpanded, setIsInsightExpanded] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editingBio, setEditingBio] = useState('');
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Meeting Prep state
  const [showMeetingBrief, setShowMeetingBrief] = useState(false);
  const [meetingBrief, setMeetingBrief] = useState<any>(null);
  const [isLoadingBrief, setIsLoadingBrief] = useState(false);
  const [showMeetingFollowUp, setShowMeetingFollowUp] = useState(false);
  const [meetingNoteText, setMeetingNoteText] = useState('');
  const [meetingFollowUpResult, setMeetingFollowUpResult] = useState<any>(null);
  const [isProcessingFollowUp, setIsProcessingFollowUp] = useState(false);

  // Messaging Integrations state
  const [messagingAccounts, setMessagingAccounts] = useState<any[]>([]);
  const [showLinkingModal, setShowLinkingModal] = useState(false);
  const [linkingPlatform, setLinkingPlatform] = useState<'line'>('line');
  const [linkingToken, setLinkingToken] = useState('');
  const [linkingCountdown, setLinkingCountdown] = useState(0);

  // WhatsApp Baileys state
  const [waStatus, setWaStatus] = useState<{ status: string; phoneNumber: string | null }>({ status: 'disconnected', phoneNumber: null });
  const [showWaConnectModal, setShowWaConnectModal] = useState(false);
  const [waPhoneInput, setWaPhoneInput] = useState('');
  const [waPairingCode, setWaPairingCode] = useState('');
  const [isWaConnecting, setIsWaConnecting] = useState(false);
  const [waCountdown, setWaCountdown] = useState(0);
  const [showWaImportModal, setShowWaImportModal] = useState(false);
  const [waContacts, setWaContacts] = useState<any[]>([]);
  const [waSelectedIds, setWaSelectedIds] = useState<Set<string>>(new Set());
  const [isWaImporting, setIsWaImporting] = useState(false);

  // Edit contact state
  const [showEditContactModal, setShowEditContactModal] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<Contact>>({});
  const [isEditingInsight, setIsEditingInsight] = useState(false);
  const [editingInsight, setEditingInsight] = useState('');

  // Fetch relationship and interactions data for this contact
  useEffect(() => {
    if (selectedContact?.id) {
      // Reset AI summary when contact changes
      setAiSummary(selectedContact.ai_summary || null);

      // Fetch relationship
      relationshipsApi.list(selectedContact.id).then((result) => {
        if (result.data) {
          const directRel = result.data.find((r: any) => r.is_user_relationship === 1);
          setUserRelationship(directRel || null);
        }
      });

      // Fetch interactions
      setIsLoadingInteractions(true);
      interactionsApi.list({ contactId: selectedContact.id, limit: 20 }).then((result) => {
        if (result.data) {
          setInteractions(result.data);
        }
        setIsLoadingInteractions(false);
      });
    } else {
      setInteractions([]);
      setUserRelationship(null);
      setAiSummary(null);
    }
  }, [selectedContact?.id]);

  // Generate AI summary for the contact
  const generateAiSummary = async () => {
    if (!selectedContact?.id) return;

    setIsGeneratingSummary(true);
    const result = await aiApi.generateSummary(selectedContact.id);

    if (result.data?.summary) {
      setAiSummary(result.data.summary);
      // Update the contact in the store with the new summary
      if (result.data.contact) {
        setSelectedContact(result.data.contact);
      }
    }
    setIsGeneratingSummary(false);
  };

  // Fetch messaging accounts on user profile
  useEffect(() => {
    if (!selectedContact) {
      messagingApi.listAccounts().then(res => {
        if (res.data) setMessagingAccounts(res.data);
      });
      messagingApi.whatsappStatus().then(res => {
        if (res.data) setWaStatus({ status: res.data.status, phoneNumber: res.data.phoneNumber });
      });
    }
  }, [selectedContact]);

  // LINE Linking modal countdown
  useEffect(() => {
    if (!showLinkingModal || linkingCountdown <= 0) return;
    const timer = setInterval(() => {
      setLinkingCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); setShowLinkingModal(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showLinkingModal, linkingCountdown]);

  // LINE Linking modal polling (separate from countdown to avoid restart each tick)
  useEffect(() => {
    if (!showLinkingModal) return;
    const poller = setInterval(async () => {
      const res = await messagingApi.checkLinkStatus(linkingPlatform);
      if (res.data?.linked) {
        clearInterval(poller);
        setShowLinkingModal(false);
        setLinkingCountdown(0);
        const accts = await messagingApi.listAccounts();
        if (accts.data) setMessagingAccounts(accts.data);
      }
    }, 3000);
    return () => clearInterval(poller);
  }, [showLinkingModal, linkingPlatform]);

  // WhatsApp pairing code countdown + polling
  useEffect(() => {
    if (!showWaConnectModal || waCountdown <= 0 || !waPairingCode) return;
    const timer = setInterval(() => {
      setWaCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); setShowWaConnectModal(false); setWaPairingCode(''); return 0; }
        return prev - 1;
      });
    }, 1000);
    const poller = setInterval(async () => {
      const res = await messagingApi.whatsappStatus();
      if (res.data?.status === 'connected') {
        clearInterval(poller);
        clearInterval(timer);
        setShowWaConnectModal(false);
        setWaPairingCode('');
        setWaStatus({ status: 'connected', phoneNumber: res.data.phoneNumber });
      }
    }, 3000);
    return () => { clearInterval(timer); clearInterval(poller); };
  }, [showWaConnectModal, waCountdown, waPairingCode]);

  // Continue polling WhatsApp status while connecting (even if modal closed)
  useEffect(() => {
    if (waStatus.status !== 'connecting') return;
    const poller = setInterval(async () => {
      const res = await messagingApi.whatsappStatus();
      if (res.data?.status === 'connected') {
        clearInterval(poller);
        setWaStatus({ status: 'connected', phoneNumber: res.data.phoneNumber });
      } else if (res.data?.status === 'disconnected' || res.data?.status === 'logged_out') {
        clearInterval(poller);
        setWaStatus({ status: res.data.status, phoneNumber: null });
      }
    }, 5000);
    return () => clearInterval(poller);
  }, [waStatus.status]);

  const handleGenerateBrief = async () => {
    if (!selectedContact?.id) return;
    setIsLoadingBrief(true);
    setShowMeetingBrief(true);
    const res = await aiApi.generateMeetingBrief(selectedContact.id, currentLocale);
    if (res.data) setMeetingBrief(res.data);
    setIsLoadingBrief(false);
  };

  const handleProcessFollowUp = async () => {
    if (!selectedContact?.id || !meetingNoteText.trim()) return;
    setIsProcessingFollowUp(true);
    const res = await aiApi.processMeetingFollowUp(selectedContact.id, meetingNoteText, currentLocale);
    if (res.data) {
      setMeetingFollowUpResult(res.data);
      // Refresh interactions
      const intRes = await interactionsApi.list({ contactId: selectedContact.id, limit: 20 });
      if (intRes.data) setInteractions(intRes.data);
    }
    setIsProcessingFollowUp(false);
  };

  const handleConnectLine = async () => {
    setLinkingPlatform('line');
    const res = await messagingApi.generateToken('line');
    if (res.data) {
      setLinkingToken(res.data.token);
      setLinkingCountdown(res.data.expiresInSeconds);
      setShowLinkingModal(true);
    }
  };

  const handleConnectWhatsApp = async () => {
    if (!waPhoneInput.trim()) return;
    setIsWaConnecting(true);
    const res = await messagingApi.whatsappConnect(waPhoneInput.trim());
    setIsWaConnecting(false);
    if (res.data?.pairingCode) {
      setWaPairingCode(res.data.pairingCode);
      setWaCountdown(180);
      setWaStatus({ status: 'connecting', phoneNumber: waPhoneInput.trim() });
    }
  };

  const handleDisconnectWhatsApp = async () => {
    await messagingApi.whatsappDisconnect();
    setWaStatus({ status: 'disconnected', phoneNumber: null });
  };

  const handleWaImport = async () => {
    const res = await messagingApi.whatsappContacts();
    if (res.data) {
      setWaContacts(res.data);
      setWaSelectedIds(new Set());
      setShowWaImportModal(true);
    }
  };

  const handleWaImportSelected = async () => {
    if (waSelectedIds.size === 0) return;
    setIsWaImporting(true);
    const res = await messagingApi.whatsappImportContacts(Array.from(waSelectedIds));
    setIsWaImporting(false);
    if (res.data) {
      setShowWaImportModal(false);
      // Refresh contacts list
      const freshContacts = await messagingApi.whatsappContacts();
      if (freshContacts.data) setWaContacts(freshContacts.data);
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [newInteraction, setNewInteraction] = useState({ title: t('interaction.meeting'), note: '', type: 'meeting' });
  const [showMenu, setShowMenu] = useState(false);

  // Open edit contact modal
  const openEditContactModal = () => {
    if (selectedContact) {
      setEditingContact({
        name: selectedContact.name || '',
        company: selectedContact.company || '',
        title: selectedContact.title || '',
        department: selectedContact.department || '',
        email: selectedContact.email || '',
        phone: selectedContact.phone || '',
        notes: selectedContact.notes || '',
        line_id: selectedContact.line_id || '',
        telegram_username: selectedContact.telegram_username || '',
        whatsapp_number: selectedContact.whatsapp_number || '',
        wechat_id: selectedContact.wechat_id || '',
        twitter_handle: selectedContact.twitter_handle || '',
        instagram_handle: selectedContact.instagram_handle || '',
        linkedin_url: selectedContact.linkedin_url || '',
      });
      setShowEditContactModal(true);
    }
  };

  // Save edited contact
  const handleSaveContact = async () => {
    if (!selectedContact?.id || !editingContact.name?.trim()) return;

    setIsSavingContact(true);
    const success = await updateContact(selectedContact.id, {
      name: editingContact.name?.trim(),
      company: editingContact.company?.trim() || null,
      title: editingContact.title?.trim() || null,
      department: editingContact.department?.trim() || null,
      email: editingContact.email?.trim() || null,
      phone: editingContact.phone?.trim() || null,
      notes: editingContact.notes?.trim() || null,
      line_id: editingContact.line_id?.trim() || null,
      telegram_username: editingContact.telegram_username?.trim() || null,
      whatsapp_number: editingContact.whatsapp_number?.trim() || null,
      wechat_id: editingContact.wechat_id?.trim() || null,
      twitter_handle: editingContact.twitter_handle?.trim() || null,
      instagram_handle: editingContact.instagram_handle?.trim() || null,
      linkedin_url: editingContact.linkedin_url?.trim() || null,
    });

    if (success) {
      // Update selectedContact with new data
      setSelectedContact({
        ...selectedContact,
        ...editingContact,
      });
      setShowEditContactModal(false);
    }
    setIsSavingContact(false);
  };

  // Save edited insight/notes
  const handleSaveInsight = async () => {
    if (!selectedContact?.id) return;

    setIsSavingContact(true);
    const success = await updateContact(selectedContact.id, {
      notes: editingInsight.trim() || null,
    });

    if (success) {
      setSelectedContact({
        ...selectedContact,
        notes: editingInsight.trim() || null,
      });
      setIsEditingInsight(false);
    }
    setIsSavingContact(false);
  };

  const handleAddInteraction = async () => {
    if (!newInteraction.type || !selectedContact?.id) return;

    setIsSavingInteraction(true);
    const result = await interactionsApi.create({
      contactId: selectedContact.id,
      type: newInteraction.type as 'meeting' | 'call' | 'message' | 'email' | 'other',
      notes: newInteraction.note || undefined,
      occurredAt: new Date().toISOString(),
    });

    if (result.data) {
      setInteractions([result.data, ...interactions]);
    }
    setIsSavingInteraction(false);
    setShowAddModal(false);
    setNewInteraction({ title: t('interaction.meeting'), note: '', type: 'meeting' });
  };

  const interactionTypes = [
    { key: 'meeting', label: t('interaction.meeting') },
    { key: 'call', label: t('interaction.call') },
    { key: 'email', label: t('interaction.email') },
    { key: 'message', label: t('interaction.message') },
    { key: 'other', label: t('interaction.other') },
  ];

  // Helper to format interaction date
  const formatInteractionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('interaction.today');
    if (diffDays === 1) return t('interaction.yesterday');
    if (diffDays < 7) return t('interaction.daysAgo', { days: diffDays });
    return date.toLocaleDateString();
  };

  // Helper to get interaction title/icon
  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'meeting': return 'groups';
      case 'call': return 'call';
      case 'email': return 'email';
      case 'message': return 'chat';
      default: return 'event';
    }
  };

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
                disabled={isSavingInteraction}
                className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddInteraction}
                disabled={isSavingInteraction}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-black text-sm font-bold transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingInteraction ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                    {t('common.loading')}
                  </>
                ) : (
                  t('common.save')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-sm rounded-2xl p-6 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-full">
                <span className="material-symbols-outlined text-red-400 text-[24px]">warning</span>
              </div>
              <h3 className="text-lg font-bold text-white">{t('profile.deleteAccount')}</h3>
            </div>
            <p className="text-gray-300 text-sm mb-6">
              {t('profile.deleteAccountWarning')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingAccount}
                className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => {
                  setIsDeletingAccount(true);
                  const success = await deleteAccount();
                  setIsDeletingAccount(false);
                  if (success) {
                    setShowDeleteModal(false);
                    onNavigate('dashboard');
                  }
                }}
                disabled={isDeletingAccount}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingAccount ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {t('profile.deleting')}
                  </>
                ) : (
                  t('profile.confirmDelete')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {showEditContactModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-md rounded-2xl p-5 border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">edit</span>
                {t('profile.editContact')}
              </h3>
              <button onClick={() => setShowEditContactModal(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Basic Info */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">{t('scanCard.name')} *</label>
                <input
                  value={editingContact.name || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">{t('scanCard.company')}</label>
                  <input
                    value={editingContact.company || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, company: e.target.value })}
                    className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">{t('scanCard.jobTitle')}</label>
                  <input
                    value={editingContact.title || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, title: e.target.value })}
                    className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">{t('scanCard.department')}</label>
                <input
                  value={editingContact.department || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, department: e.target.value })}
                  placeholder={t('scanCard.departmentPlaceholder')}
                  className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                />
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">{t('scanCard.email')}</label>
                  <input
                    type="email"
                    value={editingContact.email || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                    className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">{t('scanCard.phone')}</label>
                  <input
                    type="tel"
                    value={editingContact.phone || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                    className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Social Links */}
              <div className="pt-2 border-t border-white/10">
                <h4 className="text-xs font-bold text-gray-400 mb-3">{t('scanCard.socialLinks')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">LINE ID</label>
                    <input
                      value={editingContact.line_id || ''}
                      onChange={(e) => setEditingContact({ ...editingContact, line_id: e.target.value })}
                      className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">WeChat</label>
                    <input
                      value={editingContact.wechat_id || ''}
                      onChange={(e) => setEditingContact({ ...editingContact, wechat_id: e.target.value })}
                      className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Telegram</label>
                    <input
                      value={editingContact.telegram_username || ''}
                      onChange={(e) => setEditingContact({ ...editingContact, telegram_username: e.target.value })}
                      className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">WhatsApp</label>
                    <input
                      value={editingContact.whatsapp_number || ''}
                      onChange={(e) => setEditingContact({ ...editingContact, whatsapp_number: e.target.value })}
                      className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">X/Twitter</label>
                    <input
                      value={editingContact.twitter_handle || ''}
                      onChange={(e) => setEditingContact({ ...editingContact, twitter_handle: e.target.value })}
                      className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Instagram</label>
                    <input
                      value={editingContact.instagram_handle || ''}
                      onChange={(e) => setEditingContact({ ...editingContact, instagram_handle: e.target.value })}
                      className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none transition-colors"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">LinkedIn URL</label>
                  <input
                    value={editingContact.linkedin_url || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">{t('interaction.notes')}</label>
                <textarea
                  value={editingContact.notes || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                  placeholder={t('profile.notesPlaceholder')}
                  className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors h-20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowEditContactModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveContact}
                disabled={isSavingContact || !editingContact.name?.trim()}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-black text-sm font-bold transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingContact ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                    {t('common.loading')}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    {t('common.save')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Brief Modal */}
      {showMeetingBrief && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-md rounded-2xl p-5 border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400">description</span>
                {t('meeting.briefTitle', 'Meeting Brief')}
              </h3>
              <button onClick={() => setShowMeetingBrief(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {isLoadingBrief ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                <p className="text-sm text-gray-400">{t('meeting.generatingBrief', 'Generating brief...')}</p>
              </div>
            ) : meetingBrief ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('meeting.summary', 'Summary')}</h4>
                  <p className="text-sm text-gray-200 leading-relaxed">{meetingBrief.summary}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('meeting.talkingPoints', 'Talking Points')}</h4>
                  <ul className="space-y-2">
                    {meetingBrief.talkingPoints?.map((point: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('meeting.relationshipContext', 'Relationship Context')}</h4>
                  <p className="text-sm text-gray-300">{meetingBrief.relationshipContext}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('meeting.lastInteraction', 'Last Interaction')}</h4>
                  <p className="text-sm text-gray-300">{meetingBrief.lastInteractionRecap}</p>
                </div>
                {meetingBrief.mutualConnections && meetingBrief.mutualConnections !== 'None found' && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('meeting.mutualConnections', 'Mutual Connections')}</h4>
                    <p className="text-sm text-gray-300">{meetingBrief.mutualConnections}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm py-4">{t('meeting.noBrief', 'Failed to generate brief.')}</p>
            )}
            <button onClick={() => setShowMeetingBrief(false)} className="mt-4 w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-sm transition-colors">
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      )}

      {/* Meeting Follow-Up Modal */}
      {showMeetingFollowUp && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-md rounded-2xl p-5 border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">post_add</span>
                {t('meeting.logMeetingTitle', 'Log Meeting')}
              </h3>
              <button onClick={() => setShowMeetingFollowUp(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {!meetingFollowUpResult ? (
              <>
                <p className="text-xs text-gray-400 mb-3">{t('meeting.logDescription', 'Describe what happened in the meeting. AI will extract notes, action items, and follow-up reminders.')}</p>
                <textarea
                  value={meetingNoteText}
                  onChange={(e) => setMeetingNoteText(e.target.value)}
                  placeholder={t('meeting.logPlaceholder', 'Had coffee, discussed the new project. Need to send proposal by Friday. Follow up in 2 weeks.')}
                  className="w-full bg-black/20 border border-gray-700 rounded-xl p-4 text-white text-sm focus:border-purple-400 outline-none h-32 resize-none mb-4 placeholder:text-gray-500 transition-colors"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowMeetingFollowUp(false)} className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors">
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleProcessFollowUp}
                    disabled={isProcessingFollowUp || !meetingNoteText.trim()}
                    className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessingFollowUp ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    )}
                    {t('meeting.processWithAI', 'Process with AI')}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-green-900/20 border border-green-800/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-green-400 text-[18px]">check_circle</span>
                    <span className="text-sm font-bold text-green-400">{t('meeting.interactionCreated', 'Interaction Logged')}</span>
                  </div>
                  <p className="text-xs text-gray-300">{meetingFollowUpResult.cleanedNotes}</p>
                </div>
                {meetingFollowUpResult.actionItems?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('meeting.actionItems', 'Action Items')}</h4>
                    {meetingFollowUpResult.actionItems.map((item: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-200 mb-1.5">
                        <span className="material-symbols-outlined text-yellow-400 text-[16px] mt-0.5">task_alt</span>
                        <span>{item.task}{item.dueDate ? ` (${item.dueDate})` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
                {meetingFollowUpResult.createdReminder && (
                  <div className="p-3 rounded-xl bg-blue-900/20 border border-blue-800/30">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-400 text-[16px]">alarm</span>
                      <span className="text-sm text-blue-300">{t('meeting.reminderCreated', 'Reminder created')}: {meetingFollowUpResult.createdReminder.note}</span>
                    </div>
                  </div>
                )}
                <button onClick={() => setShowMeetingFollowUp(false)} className="w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-sm transition-colors">
                  {t('common.close', 'Close')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LINE Linking Token Modal */}
      {showLinkingModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-sm rounded-2xl p-6 border border-white/10 shadow-2xl text-center">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ color: '#00B900' }}>chat</span>
                {t('messaging.connectTitle', { platform: 'LINE', defaultValue: 'Connect {{platform}}' })}
              </h3>
              <button onClick={() => setShowLinkingModal(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Step 1: Add bot */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-[#00B900] text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                <p className="text-sm text-gray-300 text-left">
                  {t('messaging.line.step1AddBot', 'Scan QR code to add Warmly bot on LINE:')}
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 inline-block mb-2">
                <img src="/WarmlyBot_QR.png" alt="Warmly LINE Bot QR" className="w-36 h-36" />
              </div>
            </div>

            {/* Step 2: Send code */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-[#00B900] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <p className="text-sm text-gray-300 text-left">
                  {t('messaging.line.step2SendCode', 'Send this code to the Warmly bot:')}
                </p>
              </div>
              <div className="text-4xl font-mono font-black text-white tracking-[0.3em] bg-black/30 rounded-2xl py-5 mb-3 border border-white/10">
                {linkingToken}
              </div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="material-symbols-outlined text-yellow-400 text-[18px]">timer</span>
                <span className="text-yellow-400 font-medium">
                  {Math.floor(linkingCountdown / 60)}:{String(linkingCountdown % 60).padStart(2, '0')}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              {t('messaging.waitingForLink', 'Waiting for connection... This modal will close automatically.')}
            </p>
          </div>
        </div>
      )}

      {/* WhatsApp Connect Modal */}
      {showWaConnectModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-sm rounded-2xl p-6 border border-white/10 shadow-2xl text-center">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ color: '#25D366' }}>chat</span>
                {t('messaging.whatsapp.connectWhatsApp', 'Connect WhatsApp')}
              </h3>
              <button onClick={() => { setShowWaConnectModal(false); setWaPairingCode(''); }} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {!waPairingCode ? (
              <div className="mb-4">
                <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2.5 mb-4">
                  <span className="material-symbols-outlined text-yellow-400 text-[18px] mt-0.5 shrink-0">warning</span>
                  <p className="text-xs text-yellow-400/90 text-left">
                    {t('messaging.whatsapp.rateLimitWarning', 'WhatsApp limits pairing attempts. If your code is rejected, please wait 15–30 minutes before trying again.')}
                  </p>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  {t('messaging.whatsapp.enterPhone', 'Enter your phone number with country code (e.g. 14155551234):')}
                </p>
                <input
                  type="tel"
                  value={waPhoneInput}
                  onChange={(e) => setWaPhoneInput(e.target.value)}
                  placeholder="14155551234"
                  className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white text-center text-lg font-mono mb-4 outline-none focus:border-[#25D366]/50"
                />
                <button
                  onClick={handleConnectWhatsApp}
                  disabled={isWaConnecting || !waPhoneInput.trim()}
                  className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#25D366]/80 text-white font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {isWaConnecting ? t('messaging.whatsapp.connecting', 'Connecting...') : t('messaging.whatsapp.getPairingCode', 'Get Pairing Code')}
                </button>
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-4">
                  {t('messaging.whatsapp.pairingInstructions', 'Open WhatsApp → Linked Devices → Link a Device → Link with Phone Number, then enter this code:')}
                </p>
                <div className="text-4xl font-mono font-black text-white tracking-[0.3em] bg-black/30 rounded-2xl py-6 mb-4 border border-white/10">
                  {waPairingCode}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm mb-2">
                  <span className="material-symbols-outlined text-yellow-400 text-[18px]">timer</span>
                  <span className="text-yellow-400 font-medium">
                    {Math.floor(waCountdown / 60)}:{String(waCountdown % 60).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {t('messaging.waitingForLink', 'Waiting for connection... This modal will close automatically.')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp Import Contacts Modal */}
      {showWaImportModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-md rounded-2xl p-6 border border-white/10 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">
                {t('messaging.whatsapp.selectContactsToImport', 'Select Contacts to Import')}
              </h3>
              <button onClick={() => setShowWaImportModal(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {waContacts.filter(c => c.status === 'pending').length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                {t('messaging.whatsapp.noContactsFound', 'No new contacts found. Try syncing again after WhatsApp finishes loading your contacts.')}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400">
                    {waSelectedIds.size} {t('common.selected', 'selected')}
                  </span>
                  <button
                    onClick={() => {
                      const pending = waContacts.filter(c => c.status === 'pending');
                      if (waSelectedIds.size === pending.length) {
                        setWaSelectedIds(new Set());
                      } else {
                        setWaSelectedIds(new Set(pending.map(c => c.id)));
                      }
                    }}
                    className="text-xs text-[#25D366] font-bold"
                  >
                    {waSelectedIds.size === waContacts.filter(c => c.status === 'pending').length ? t('common.deselectAll', 'Deselect All') : t('common.selectAll', 'Select All')}
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 space-y-1 mb-4">
                  {waContacts.filter(c => c.status === 'pending').map(contact => (
                    <label key={contact.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={waSelectedIds.has(contact.id)}
                        onChange={() => {
                          const next = new Set(waSelectedIds);
                          if (next.has(contact.id)) next.delete(contact.id);
                          else next.add(contact.id);
                          setWaSelectedIds(next);
                        }}
                        className="accent-[#25D366] size-4"
                      />
                      <div>
                        <p className="text-sm text-white">{contact.wa_name || contact.phone_number || contact.wa_jid}</p>
                        {contact.phone_number && contact.wa_name && (
                          <p className="text-xs text-gray-400">{contact.phone_number}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleWaImportSelected}
                  disabled={isWaImporting || waSelectedIds.size === 0}
                  className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#25D366]/80 text-white font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {isWaImporting
                    ? t('common.loading', 'Loading...')
                    : t('messaging.whatsapp.importSelected', { count: waSelectedIds.size, defaultValue: `Import ${waSelectedIds.size} Contact(s)` })}
                </button>
              </>
            )}
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
                 <button onClick={() => { onNavigate('teams'); setShowMenu(false); }} className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors gap-1 group border border-white/5 hover:border-white/10">
                    <span className="material-symbols-outlined text-yellow-400 group-hover:scale-110 transition-transform">groups</span>
                    <span className="text-[10px] font-medium text-gray-300">{t('teams.title')}</span>
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-24 px-4 pt-2 flex flex-col gap-6 animate-fade-in">
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
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder={t('profile.namePlaceholder')}
                      className="bg-surface-card border border-gray-600 rounded-lg px-3 py-2 text-white text-center text-lg font-bold focus:border-primary outline-none w-48"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editingName.trim()) {
                          setIsSavingName(true);
                          updateUser({ name: editingName.trim() }).then(() => {
                            setIsSavingName(false);
                            setIsEditingName(false);
                          });
                        } else if (e.key === 'Escape') {
                          setIsEditingName(false);
                          setEditingName(user?.name || '');
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (editingName.trim()) {
                          setIsSavingName(true);
                          updateUser({ name: editingName.trim() }).then(() => {
                            setIsSavingName(false);
                            setIsEditingName(false);
                          });
                        }
                      }}
                      disabled={isSavingName || !editingName.trim()}
                      className="p-2 rounded-lg bg-primary text-black hover:bg-primary-dark disabled:opacity-50"
                    >
                      {isSavingName ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingName(false);
                        setEditingName(user?.name || '');
                      }}
                      className="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-white text-2xl font-extrabold tracking-tight">{user?.name || t('profile.myProfile')}</h1>
                    <button
                      onClick={() => {
                        setEditingName(user?.name || '');
                        setIsEditingName(true);
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      title={t('profile.editName')}
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </div>
                )}
                <p className="text-text-muted text-sm font-medium">{user?.email || ''}</p>
              </div>
            </div>

            {/* Bio / Purpose Section */}
            <div className="bg-surface-card p-5 rounded-2xl shadow-sm border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[16px]">target</span>
                  {t('profile.myGoal')}
                </h3>
                {!isEditingBio && (
                  <button
                    onClick={() => {
                      setEditingBio(user?.bio || '');
                      setIsEditingBio(true);
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                )}
              </div>
              {isEditingBio ? (
                <div className="space-y-3">
                  <textarea
                    value={editingBio}
                    onChange={(e) => setEditingBio(e.target.value)}
                    placeholder={t('profile.bioPlaceholder')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 resize-none"
                    rows={4}
                    maxLength={500}
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{editingBio.length}/500</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setIsEditingBio(false);
                          setEditingBio(user?.bio || '');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-gray-700 text-white text-sm hover:bg-gray-600"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={() => {
                          setIsSavingBio(true);
                          updateUser({ bio: editingBio.trim() }).then(() => {
                            setIsSavingBio(false);
                            setIsEditingBio(false);
                          });
                        }}
                        disabled={isSavingBio}
                        className="px-3 py-1.5 rounded-lg bg-primary text-black text-sm font-medium hover:bg-primary-dark disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isSavingBio ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-black"></div>
                        ) : (
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        )}
                        {t('common.save')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : user?.bio ? (
                <p className="text-gray-300 text-sm leading-relaxed">{user.bio}</p>
              ) : (
                <button
                  onClick={() => {
                    setEditingBio('');
                    setIsEditingBio(true);
                  }}
                  className="w-full py-4 border border-dashed border-white/20 rounded-xl text-gray-400 text-sm hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  {t('profile.addBio')}
                </button>
              )}
              <p className="text-xs text-gray-500 mt-3 flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[14px] mt-0.5">info</span>
                {t('profile.bioHint')}
              </p>
            </div>

            {/* Messaging Integrations */}
            <div className="bg-surface-card p-5 rounded-2xl shadow-sm border border-white/5">
              <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[16px]">forum</span>
                {t('messaging.integrations', 'Messaging Integrations')}
              </h3>
              <div className="space-y-3">
                {/* LINE */}
                {(() => {
                  const lineAccount = messagingAccounts.find(a => a.platform === 'line' && a.is_active);
                  return (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-[#00B900]/20 flex items-center justify-center text-[#00B900] font-bold text-sm">LINE</div>
                        <div>
                          <p className="text-sm font-medium text-white">LINE</p>
                          <p className="text-xs text-gray-400">
                            {lineAccount ? `${t('messaging.connected', 'Connected')}${lineAccount.display_name ? ` — ${lineAccount.display_name}` : ''}` : t('messaging.notConnected', 'Not connected')}
                          </p>
                        </div>
                      </div>
                      {lineAccount ? (
                        <button
                          onClick={async () => { await messagingApi.disconnect(lineAccount.id); const res = await messagingApi.listAccounts(); if (res.data) setMessagingAccounts(res.data); }}
                          className="px-3 py-1.5 rounded-lg bg-red-900/20 text-red-400 text-xs font-bold border border-red-800/30 hover:bg-red-900/30"
                        >
                          {t('messaging.disconnect', 'Disconnect')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnectLine()}
                          className="px-3 py-1.5 rounded-lg bg-[#00B900]/20 text-[#00B900] text-xs font-bold border border-[#00B900]/30 hover:bg-[#00B900]/30"
                        >
                          {t('messaging.connect', 'Connect')}
                        </button>
                      )}
                    </div>
                  );
                })()}
                {/* WhatsApp (Baileys) */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-[#25D366]/20 flex items-center justify-center text-[#25D366] font-bold text-xs">WA</div>
                    <div>
                      <p className="text-sm font-medium text-white">WhatsApp</p>
                      <p className="text-xs text-gray-400">
                        {waStatus.status === 'connected'
                          ? `${t('messaging.whatsapp.connected', 'Connected')}${waStatus.phoneNumber ? ` — ${waStatus.phoneNumber}` : ''}`
                          : waStatus.status === 'connecting'
                          ? t('messaging.whatsapp.connecting', 'Connecting...')
                          : t('messaging.whatsapp.disconnected', 'Not connected')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {waStatus.status === 'connected' && (
                      <>
                        <button
                          onClick={handleWaImport}
                          className="px-3 py-1.5 rounded-lg bg-[#25D366]/20 text-[#25D366] text-xs font-bold border border-[#25D366]/30 hover:bg-[#25D366]/30"
                        >
                          {t('messaging.whatsapp.importContacts', 'Import')}
                        </button>
                        <button
                          onClick={handleDisconnectWhatsApp}
                          className="px-3 py-1.5 rounded-lg bg-red-900/20 text-red-400 text-xs font-bold border border-red-800/30 hover:bg-red-900/30"
                        >
                          {t('messaging.whatsapp.disconnectWhatsApp', 'Disconnect')}
                        </button>
                      </>
                    )}
                    {waStatus.status !== 'connected' && (
                      <button
                        onClick={() => setShowWaConnectModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-[#25D366]/20 text-[#25D366] text-xs font-bold border border-[#25D366]/30 hover:bg-[#25D366]/30"
                      >
                        {t('messaging.whatsapp.connectWhatsApp', 'Connect')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3 flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[14px] mt-0.5">info</span>
                {t('messaging.hint', 'Connect messaging apps to add contacts by sending business cards or descriptions to the bot.')}
              </p>
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
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-orange-400">logout</span>
                  <span className="text-sm font-medium text-white">{t('common.exit')}</span>
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-900/20 hover:bg-red-900/30 transition-colors text-left border border-red-800/30"
                >
                  <span className="material-symbols-outlined text-red-400">delete_forever</span>
                  <span className="text-sm font-medium text-red-400">{t('profile.deleteAccount')}</span>
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
            <div className="flex items-center gap-2">
              <h1 className="text-white text-2xl font-extrabold tracking-tight">{selectedContact.name}</h1>
              <button
                onClick={openEditContactModal}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title={t('profile.editContact')}
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            </div>
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
              <button
                className="flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors group active:scale-[0.98]"
                onClick={() => {
                  navigator.clipboard.writeText(selectedContact.email!);
                }}
              >
                <span className="material-symbols-outlined text-[18px] text-gray-400">mail</span>
                <span className="text-sm text-gray-200 flex-1 text-left">{selectedContact.email}</span>
                <span className="material-symbols-outlined text-[16px] text-gray-500 group-hover:text-primary transition-colors">content_copy</span>
              </button>
            )}
            {selectedContact.phone && (
              <div className="flex flex-col gap-2 mt-2">
                {selectedContact.phone.split(',').map((phone, idx) => (
                  <button
                    key={idx}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors group active:scale-[0.98]"
                    onClick={() => {
                      navigator.clipboard.writeText(phone.trim());
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px] text-gray-400">phone</span>
                    <span className="text-sm text-gray-200 flex-1 text-left">{phone.trim()}</span>
                    <span className="material-symbols-outlined text-[16px] text-gray-500 group-hover:text-primary transition-colors">content_copy</span>
                  </button>
                ))}
              </div>
            )}

            {/* Social Media Links */}
            {(selectedContact.line_id || selectedContact.telegram_username || selectedContact.whatsapp_number ||
              selectedContact.wechat_id || selectedContact.twitter_handle || selectedContact.instagram_handle ||
              selectedContact.linkedin_url) && (
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedContact.line_id && (
                  <a href={`https://line.me/R/ti/p/${selectedContact.line_id}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00B900]/20 border border-[#00B900]/30 text-[#00B900] text-xs font-medium hover:bg-[#00B900]/30 transition-colors">
                    <span className="text-sm">LINE</span>
                  </a>
                )}
                {selectedContact.telegram_username && (
                  <a href={`https://t.me/${selectedContact.telegram_username}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0088cc]/20 border border-[#0088cc]/30 text-[#0088cc] text-xs font-medium hover:bg-[#0088cc]/30 transition-colors">
                    <span className="text-sm">Telegram</span>
                  </a>
                )}
                {selectedContact.whatsapp_number && (
                  <a href={`https://wa.me/${selectedContact.whatsapp_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] text-xs font-medium hover:bg-[#25D366]/30 transition-colors">
                    <span className="text-sm">WhatsApp</span>
                  </a>
                )}
                {selectedContact.wechat_id && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#07C160]/20 border border-[#07C160]/30 text-[#07C160] text-xs font-medium cursor-pointer hover:bg-[#07C160]/30 transition-colors"
                    onClick={() => navigator.clipboard.writeText(selectedContact.wechat_id!)}>
                    <span className="text-sm">WeChat: {selectedContact.wechat_id}</span>
                  </div>
                )}
                {selectedContact.twitter_handle && (
                  <a href={`https://twitter.com/${selectedContact.twitter_handle}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1DA1F2]/20 border border-[#1DA1F2]/30 text-[#1DA1F2] text-xs font-medium hover:bg-[#1DA1F2]/30 transition-colors">
                    <span className="text-sm">X/Twitter</span>
                  </a>
                )}
                {selectedContact.instagram_handle && (
                  <a href={`https://instagram.com/${selectedContact.instagram_handle}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#E4405F]/20 border border-[#E4405F]/30 text-[#E4405F] text-xs font-medium hover:bg-[#E4405F]/30 transition-colors">
                    <span className="text-sm">Instagram</span>
                  </a>
                )}
                {selectedContact.linkedin_url && (
                  <a href={selectedContact.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0A66C2]/20 border border-[#0A66C2]/30 text-[#0A66C2] text-xs font-medium hover:bg-[#0A66C2]/30 transition-colors">
                    <span className="text-sm">LinkedIn</span>
                  </a>
                )}
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

        {/* Meeting Prep & Log */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleGenerateBrief}
            disabled={isLoadingBrief}
            className="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold text-sm hover:bg-blue-600/30 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">description</span>
            {t('meeting.prepMeeting', 'Prep Meeting')}
          </button>
          <button
            onClick={() => { setShowMeetingFollowUp(true); setMeetingFollowUpResult(null); setMeetingNoteText(''); }}
            className="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 font-bold text-sm hover:bg-purple-600/30 active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">post_add</span>
            {t('meeting.logMeeting', 'Log Meeting')}
          </button>
        </div>

        {/* Insight Card */}
        <div className="bg-surface-card p-6 rounded-2xl shadow-sm border border-white/5 relative group flex flex-col">
          <div className="absolute right-0 -top-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                  <span className="material-symbols-outlined icon-filled text-[18px]">auto_awesome</span>
                </div>
                <h3 className="font-bold text-white text-base">{t('profile.warmlyInsight')}</h3>
              </div>
              <button
                onClick={generateAiSummary}
                disabled={isGeneratingSummary}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isGeneratingSummary ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                    <span>{t('profile.generating')}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[14px]">{aiSummary ? 'refresh' : 'auto_awesome'}</span>
                    <span>{aiSummary ? t('profile.regenerate') : t('profile.generate')}</span>
                  </>
                )}
              </button>
            </div>
            {isGeneratingSummary ? (
              <div className="flex items-center gap-2 py-4">
                <div className="animate-pulse flex-1 space-y-2">
                  <div className="h-3 bg-white/10 rounded w-full"></div>
                  <div className="h-3 bg-white/10 rounded w-4/5"></div>
                  <div className="h-3 bg-white/10 rounded w-3/5"></div>
                </div>
              </div>
            ) : isEditingInsight ? (
              <div className="space-y-3">
                <textarea
                  value={editingInsight}
                  onChange={(e) => setEditingInsight(e.target.value)}
                  placeholder={t('profile.insightPlaceholder')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 resize-none"
                  rows={4}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsEditingInsight(false);
                      setEditingInsight('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gray-700 text-white text-sm hover:bg-gray-600"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleSaveInsight}
                    disabled={isSavingContact}
                    className="px-3 py-1.5 rounded-lg bg-primary text-black text-sm font-medium hover:bg-primary-dark disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSavingContact ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-black"></div>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    )}
                    {t('common.save')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="group/insight">
                <div className="flex items-start gap-2">
                  <p className={`flex-1 text-gray-300 text-[15px] leading-relaxed ${!isInsightExpanded ? 'line-clamp-4' : ''}`}>
                    {aiSummary || selectedContact.notes || t('profile.defaultInsight', { name: selectedContact.name })}
                  </p>
                  <button
                    onClick={() => {
                      setEditingInsight(selectedContact.notes || '');
                      setIsEditingInsight(true);
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors opacity-0 group-hover/insight:opacity-100"
                    title={t('common.edit')}
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                </div>
                {(aiSummary || selectedContact.notes || '').length > 200 && (
                  <button
                    onClick={() => setIsInsightExpanded(!isInsightExpanded)}
                    className="text-primary text-sm font-medium mt-2 hover:underline"
                  >
                    {isInsightExpanded ? t('common.close') : t('profile.viewAnalysis')}
                  </button>
                )}
              </div>
            )}
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

            {isLoadingInteractions ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : interactions.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <span className="material-symbols-outlined text-3xl mb-2 block">history</span>
                <p className="text-sm">{t('profile.noInteractions')}</p>
                <p className="text-xs mt-1">{t('profile.tapToLog')}</p>
              </div>
            ) : (
              interactions.map((interaction) => (
                <div key={interaction.id} className="relative flex gap-4 items-start group animate-fade-in">
                  <div
                    className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-[2px] shadow-sm
                      ${interaction.type === 'meeting' || interaction.type === 'call'
                        ? 'bg-background-dark border-primary shadow-primary/20'
                        : 'bg-surface-card border-gray-600'}`}
                  >
                    <span className="material-symbols-outlined text-[12px] text-gray-400">{getInteractionIcon(interaction.type)}</span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-white text-sm capitalize">{t(`interaction.${interaction.type}`)}</span>
                      <span className="text-xs text-gray-400">{formatInteractionDate(interaction.occurred_at)}</span>
                    </div>
                    {interaction.notes && (
                      <p className="text-xs text-gray-400 line-clamp-2">{interaction.notes}</p>
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
