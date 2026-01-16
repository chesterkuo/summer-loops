import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenName } from '../App';
import { pathsApi, contactsApi, relationshipsApi, Contact } from '../services/api';
import { useContactStore } from '../stores/contactStore';
import { useAuthStore } from '../stores/authStore';

interface IntroRequest {
  id: string;
  target_contact_id: string | null;
  target_description: string | null;
  path_data: string | null;
  generated_message: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'introduced' | 'success' | 'failed';
  created_at: string;
  updated_at: string;
  targetContact?: Contact;
}

interface DraftRequestProps {
  onNavigate: (screen: ScreenName) => void;
}

const DraftRequest: React.FC<DraftRequestProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { selectedContact, contacts, introPath } = useContactStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'draft' | 'history'>('draft');
  const [tone, setTone] = useState<'formal' | 'casual' | 'brief'>('casual');
  const [draftContent, setDraftContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [goal, setGoal] = useState('discuss potential collaboration opportunities');
  const [introRequests, setIntroRequests] = useState<IntroRequest[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDirectContact, setIsDirectContact] = useState(true); // Default to true (1st degree)
  const [showSendModal, setShowSendModal] = useState(false);
  const [connectorContact, setConnectorContact] = useState<Contact | null>(null);

  // Check if selected contact is a direct (1st degree) connection
  useEffect(() => {
    if (selectedContact?.id) {
      relationshipsApi.list(selectedContact.id).then((result) => {
        if (result.data) {
          const directRel = result.data.find((r: any) => r.is_user_relationship === 1);
          setIsDirectContact(!!directRel);
        }
      });
    }
  }, [selectedContact?.id]);

  // Fetch connector's full contact info for send options
  useEffect(() => {
    if (introPath && introPath.length >= 2 && introPath[1].contactId) {
      contactsApi.get(introPath[1].contactId).then((result) => {
        if (result.data) {
          setConnectorContact(result.data);
        }
      });
    } else if (!isDirectContact && contacts.length > 0) {
      // Fallback to first contact
      setConnectorContact(contacts[0]);
    }
  }, [introPath, isDirectContact, contacts]);

  // Fetch introduction request history
  useEffect(() => {
    if (activeTab === 'history') {
      setIsLoadingHistory(true);
      pathsApi.listRequests({ limit: 20 }).then(async (result) => {
        if (result.data) {
          // Fetch contact info for each request
          const requestsWithContacts = await Promise.all(
            result.data.map(async (req: IntroRequest) => {
              if (req.target_contact_id) {
                const contactResult = await contactsApi.get(req.target_contact_id);
                return { ...req, targetContact: contactResult.data };
              }
              return req;
            })
          );
          setIntroRequests(requestsWithContacts);
        }
        setIsLoadingHistory(false);
      });
    }
  }, [activeTab]);

  // Save as introduction request
  const saveAsRequest = async (status: 'draft' | 'sent') => {
    if (!draftContent) return;
    setIsSaving(true);

    const result = await pathsApi.createRequest({
      targetContactId: selectedContact?.id,
      targetDescription: selectedContact?.name || goal,
      generatedMessage: draftContent,
    });

    if (result.data && status === 'sent') {
      await pathsApi.updateRequest(result.data.id, { status: 'sent' });
    }

    setIsSaving(false);
    setActiveTab('history');
  };

  // Update request status
  const updateRequestStatus = async (id: string, status: string) => {
    await pathsApi.updateRequest(id, { status });
    setIntroRequests(prev =>
      prev.map(req => req.id === id ? { ...req, status: status as IntroRequest['status'] } : req)
    );
  };

  // Get send target (connector for 2nd+ degree, or selected contact for direct)
  const sendTarget = isDirectContact ? selectedContact : connectorContact;

  // Handle send via different channels
  const handleSendVia = async (channel: string) => {
    // Copy message to clipboard first
    await navigator.clipboard.writeText(draftContent);

    // Save the request
    await saveAsRequest('sent');

    // Open the appropriate app
    const target = sendTarget;
    if (!target) return;

    switch (channel) {
      case 'email':
        const subject = encodeURIComponent(`Introduction Request: ${selectedContact?.name || 'Contact'}`);
        const body = encodeURIComponent(draftContent);
        window.open(`mailto:${target.email}?subject=${subject}&body=${body}`);
        break;
      case 'line':
        // LINE doesn't support pre-filled messages well, but we can try
        window.open(`https://line.me/R/ti/p/${target.line_id}`);
        break;
      case 'telegram':
        const tgText = encodeURIComponent(draftContent);
        window.open(`https://t.me/${target.telegram_username}?text=${tgText}`);
        break;
      case 'whatsapp':
        const waPhone = target.whatsapp_number?.replace(/[^0-9]/g, '');
        const waText = encodeURIComponent(draftContent);
        window.open(`https://wa.me/${waPhone}?text=${waText}`);
        break;
      case 'wechat':
        // WeChat doesn't have URL scheme for messaging, just copy ID
        alert(`WeChat ID copied: ${target.wechat_id}\nMessage copied to clipboard.`);
        break;
    }

    setShowSendModal(false);
  };

  // Get available send options based on contact info
  const getSendOptions = () => {
    const target = sendTarget;
    if (!target) return [];

    const options = [];
    if (target.email) {
      options.push({ id: 'email', label: 'Email', icon: 'mail', color: '#EA4335', value: target.email });
    }
    if (target.line_id) {
      options.push({ id: 'line', label: 'LINE', icon: 'chat', color: '#00B900', value: target.line_id });
    }
    if (target.telegram_username) {
      options.push({ id: 'telegram', label: 'Telegram', icon: 'send', color: '#0088cc', value: `@${target.telegram_username}` });
    }
    if (target.whatsapp_number) {
      options.push({ id: 'whatsapp', label: 'WhatsApp', icon: 'phone', color: '#25D366', value: target.whatsapp_number });
    }
    if (target.wechat_id) {
      options.push({ id: 'wechat', label: 'WeChat', icon: 'forum', color: '#07C160', value: target.wechat_id });
    }
    return options;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500/20 text-gray-300 border-gray-600';
      case 'sent': return 'bg-blue-500/20 text-blue-300 border-blue-600';
      case 'accepted': return 'bg-yellow-500/20 text-yellow-300 border-yellow-600';
      case 'introduced': return 'bg-purple-500/20 text-purple-300 border-purple-600';
      case 'success': return 'bg-green-500/20 text-green-300 border-green-600';
      case 'failed': return 'bg-red-500/20 text-red-300 border-red-600';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-600';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // For direct contacts: message goes directly to them
  // For indirect contacts: we need a connector (from path discovery)
  const target = selectedContact;

  // Use introPath if available (from path discovery), otherwise fall back to first contact
  // introPath format: [You, connector, ..., target] - index 1 is the connector (your direct contact)
  const connectorFromPath = introPath && introPath.length >= 3 ? {
    id: introPath[1].contactId,
    name: introPath[1].name,
    company: introPath[1].company
  } : null;

  // Only use connector for non-direct contacts (2nd+ degree)
  const connector = !isDirectContact ? (connectorFromPath || contacts[0]) : null;

  const generateMessage = async (selectedTone: 'formal' | 'casual' | 'brief') => {
    if (!target) {
      setDraftContent('Please select a contact to generate a message.');
      return;
    }

    setIsGenerating(true);

    let path;
    if (isDirectContact) {
      // Direct contact: message from You to Target
      path = [
        { name: 'You', company: undefined, relationship: 'self' },
        { name: target.name, company: target.company || undefined, relationship: 'direct contact' },
      ];
    } else {
      // Indirect contact: You → Connector → Target
      path = [
        { name: 'You', company: undefined, relationship: 'self' },
        { name: connector?.name || 'Connection', company: connector?.company || undefined, relationship: 'direct contact' },
        { name: target.name, company: target.company || undefined, relationship: 'target' },
      ];
    }

    const result = await pathsApi.generateMessage({
      path,
      goal: isDirectContact ? 'reach out and connect' : goal,
      tone: selectedTone,
      senderName: user?.name,
      senderBio: user?.bio,
    });

    if (result.data?.message) {
      setDraftContent(result.data.message);
    } else {
      setDraftContent('Failed to generate message. Please try again.');
    }
    setIsGenerating(false);
  };

  const handleGenerate = () => {
    generateMessage(tone);
  };

  return (
    <div className="bg-background-dark min-h-full flex flex-col font-display text-white">
      {/* Top Bar */}
      <nav className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => onNavigate('path')} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors text-white">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <h1 className="text-base font-bold text-gray-100">{t('draftRequest.title')}</h1>
          <div className="w-10"></div>
        </div>
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('draft')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'draft' ? 'bg-primary text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {t('draftRequest.newDraft')}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-primary text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {t('draftRequest.history')}
          </button>
        </div>
      </nav>

      <main className="flex-1 px-4 py-6 pb-32 flex flex-col gap-6 overflow-y-auto">
        {activeTab === 'history' ? (
          /* History View */
          <section className="flex flex-col gap-4">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : introRequests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <span className="material-symbols-outlined text-4xl mb-3 block">history</span>
                <p className="text-sm">{t('draftRequest.noHistory')}</p>
                <p className="text-xs mt-1">{t('draftRequest.noHistoryDesc')}</p>
              </div>
            ) : (
              introRequests.map((req) => (
                <div key={req.id} className="bg-surface-card p-4 rounded-xl border border-white/5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                        <span className="text-sm font-bold text-white">
                          {req.targetContact?.name?.charAt(0) || req.target_description?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">
                          {req.targetContact?.name || req.target_description || t('draftRequest.unknownTarget')}
                        </p>
                        {req.targetContact?.company && (
                          <p className="text-xs text-gray-400">{req.targetContact.company}</p>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(req.status)}`}>
                      {t(`draftRequest.status.${req.status}`)}
                    </span>
                  </div>

                  {req.generated_message && (
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3">{req.generated_message}</p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-[10px] text-gray-500">{formatDate(req.created_at)}</span>
                    <div className="flex gap-2">
                      {req.status === 'draft' && (
                        <button
                          onClick={() => updateRequestStatus(req.id, 'sent')}
                          className="text-xs font-bold text-blue-400 hover:text-blue-300"
                        >
                          {t('draftRequest.markSent')}
                        </button>
                      )}
                      {req.status === 'sent' && (
                        <button
                          onClick={() => updateRequestStatus(req.id, 'accepted')}
                          className="text-xs font-bold text-yellow-400 hover:text-yellow-300"
                        >
                          {t('draftRequest.markAccepted')}
                        </button>
                      )}
                      {req.status === 'accepted' && (
                        <button
                          onClick={() => updateRequestStatus(req.id, 'introduced')}
                          className="text-xs font-bold text-purple-400 hover:text-purple-300"
                        >
                          {t('draftRequest.markIntroduced')}
                        </button>
                      )}
                      {req.status === 'introduced' && (
                        <>
                          <button
                            onClick={() => updateRequestStatus(req.id, 'success')}
                            className="text-xs font-bold text-green-400 hover:text-green-300"
                          >
                            {t('draftRequest.markSuccess')}
                          </button>
                          <button
                            onClick={() => updateRequestStatus(req.id, 'failed')}
                            className="text-xs font-bold text-red-400 hover:text-red-300"
                          >
                            {t('draftRequest.markFailed')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        ) : (
          <>
        {/* Context Visualizer */}
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold leading-tight">
            {isDirectContact && target
              ? t('draftRequest.draftMessageTo', { name: target.name?.split(' ')[0] })
              : connector && target
              ? t('draftRequest.askingIntro', { connector: connector.name?.split(' ')[0], target: target.name?.split(' ')[0] })
              : t('draftRequest.draftIntroMessage')}
          </h2>
          <div className="bg-[#2c3536] p-5 rounded-2xl border border-gray-800 flex items-center justify-center gap-4 relative overflow-hidden">
            <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-gray-700 -translate-y-[14px] z-0"></div>
            <div className="absolute top-1/2 left-10 w-1/2 h-0.5 bg-primary/30 -translate-y-[14px] z-0"></div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full border-2 border-surface-card bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                <span className="text-lg font-bold text-white">{t('networkMap.me')}</span>
              </div>
              <span className="text-xs font-semibold text-gray-400">{t('common.you')}</span>
            </div>

            <div className="relative z-10 bg-[#2c3536] p-1 rounded-full text-gray-500">
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </div>

            {/* Show connector only for non-direct (2nd+ degree) contacts */}
            {!isDirectContact && connector && (
              <>
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full border-2 border-primary bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center ring-4 ring-primary/10">
                    <span className="text-lg font-bold text-white">{connector.name?.charAt(0)}</span>
                  </div>
                  <span className="text-xs font-bold text-primary">{connector.name?.split(' ')[0]}</span>
                </div>

                <div className="relative z-10 bg-[#2c3536] p-1 rounded-full text-gray-500">
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </div>
              </>
            )}

            {target && (
              <div className={`relative z-10 flex flex-col items-center gap-2 ${isDirectContact ? '' : 'opacity-80'}`}>
                <div className={`w-12 h-12 rounded-full border-2 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center ${isDirectContact ? 'border-primary ring-4 ring-primary/10' : 'border-surface-card grayscale'}`}>
                  <span className="text-lg font-bold text-white">{target.name?.charAt(0)}</span>
                </div>
                <span className={`text-xs font-semibold ${isDirectContact ? 'text-primary font-bold' : 'text-gray-400'}`}>{target.name?.split(' ')[0]}</span>
              </div>
            )}
          </div>
        </section>

        {/* AI Controls */}
        <section className="flex flex-col gap-4">
          <label className="text-sm font-bold text-gray-300 flex items-center gap-1.5 px-1">
            <span className="material-symbols-outlined text-[18px] text-primary">tune</span>
            {t('draftRequest.tone')}
          </label>

          <div className="flex p-1.5 bg-gray-800 rounded-xl gap-1.5">
            <button
              onClick={() => setTone('formal')}
              className={`flex-1 h-10 rounded-lg text-sm font-bold transition-all ${tone === 'formal' ? 'bg-primary text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            >
              {t('draftRequest.formal')}
            </button>
            <button
              onClick={() => setTone('casual')}
              className={`flex-1 h-10 rounded-lg text-sm font-bold transition-all ${tone === 'casual' ? 'bg-primary text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            >
              {t('draftRequest.casual')}
            </button>
            <button
              onClick={() => setTone('brief')}
              className={`flex-1 h-10 rounded-lg text-sm font-bold transition-all ${tone === 'brief' ? 'bg-primary text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            >
              {t('draftRequest.brief')}
            </button>
          </div>
        </section>

        {/* Editor */}
        <section className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-b from-primary/10 to-transparent rounded-2xl opacity-50 blur-sm pointer-events-none"></div>
          <div className="relative bg-[#2c3536] rounded-xl overflow-hidden flex flex-col min-h-[320px]">
            <div className="border-b border-gray-700 p-4 pb-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('draftRequest.subject')}</span>
                <input
                  className="bg-transparent text-sm font-semibold text-gray-100 w-full focus:outline-none"
                  type="text"
                  value={target ? t('draftRequest.introductionTo', { name: target.name?.split(' ')[0] }) : t('draftRequest.introductionRequest')}
                  readOnly
                />
              </div>
            </div>

            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                <p className="text-gray-400 text-sm">{t('draftRequest.generatingWithAI')}</p>
              </div>
            ) : !draftContent ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12">
                <span className="material-symbols-outlined text-5xl text-gray-600 mb-4">auto_awesome</span>
                <p className="text-gray-400 text-sm mb-4">{t('draftRequest.messagePlaceholder')}</p>
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-2 bg-primary text-black px-6 py-3 rounded-xl font-bold hover:bg-primary-dark transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  {t('draftRequest.generateMessage')}
                </button>
              </div>
            ) : (
              <textarea
                className="flex-1 w-full p-4 bg-transparent border-none resize-none focus:ring-0 text-base leading-relaxed text-gray-200 font-normal placeholder-gray-600"
                spellCheck={false}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
              ></textarea>
            )}

            {draftContent && (
              <div className="absolute bottom-4 right-4">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 bg-gray-800 border border-gray-600 shadow-sm hover:border-primary/50 text-xs font-semibold text-gray-300 px-3 py-2 rounded-full transition-all disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[16px] text-primary ${isGenerating ? 'animate-spin' : ''}`}>autorenew</span>
                  {isGenerating ? t('draftRequest.generating') : t('draftRequest.regenerate')}
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 px-2">
            <div className="flex items-start gap-3 text-xs text-gray-400">
              <span className="material-symbols-outlined text-[16px] text-primary mt-0.5">auto_awesome</span>
              <p>{t('draftRequest.aiGenerated')}</p>
            </div>
          </div>
        </section>
          </>
        )}
      </main>

      {activeTab === 'draft' && (
        <footer className="fixed bottom-0 left-0 w-full bg-background-dark/95 backdrop-blur-xl border-t border-gray-800 pb-safe pt-4 px-6 z-40">
          <div className="max-w-md mx-auto w-full flex gap-3 pb-6">
            <button
              onClick={() => {
                navigator.clipboard.writeText(draftContent);
                alert(t('draftRequest.copied'));
              }}
              disabled={isGenerating || !draftContent}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl border border-primary/30 text-primary font-bold hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">content_copy</span>
              <span>{t('draftRequest.copyText')}</span>
            </button>
            <button
              onClick={() => setShowSendModal(true)}
              disabled={isGenerating || !draftContent || isSaving}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-primary text-black font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">send</span>
                  <span>{t('draftRequest.saveAndSend')}</span>
                </>
              )}
            </button>
          </div>
        </footer>
      )}

      {/* Send Options Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setShowSendModal(false)}>
          <div className="bg-[#1a1f20] w-full max-w-md rounded-t-3xl p-6 pb-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {t('draftRequest.sendVia') || 'Send via'}
              </h3>
              <button onClick={() => setShowSendModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <span className="material-symbols-outlined text-gray-400">close</span>
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              {t('draftRequest.sendTo') || 'Send to'}: <span className="text-white font-medium">{sendTarget?.name}</span>
            </p>

            <div className="flex flex-col gap-3">
              {getSendOptions().length > 0 ? (
                getSendOptions().map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSendVia(option.id)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${option.color}20` }}>
                      <span className="material-symbols-outlined text-[20px]" style={{ color: option.color }}>{option.icon}</span>
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-white font-medium">{option.label}</span>
                      <p className="text-xs text-gray-500">{option.value}</p>
                    </div>
                    <span className="material-symbols-outlined text-gray-500">chevron_right</span>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <span className="material-symbols-outlined text-4xl mb-2 block">person_off</span>
                  <p>{t('draftRequest.noContactMethods') || 'No contact methods available'}</p>
                  <p className="text-xs mt-1">{t('draftRequest.addContactInfo') || 'Add email or social media to this contact'}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(draftContent);
                saveAsRequest('sent');
                setShowSendModal(false);
                alert(t('draftRequest.copiedAndSaved') || 'Message copied and saved!');
              }}
              className="mt-4 w-full py-3 rounded-xl border border-gray-600 text-gray-300 font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              {t('draftRequest.justSaveAndCopy') || 'Just save & copy to clipboard'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraftRequest;