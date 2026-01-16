import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenName } from '../App';
import { pathsApi } from '../services/api';
import { useContactStore } from '../stores/contactStore';

interface DraftRequestProps {
  onNavigate: (screen: ScreenName) => void;
}

const DraftRequest: React.FC<DraftRequestProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { selectedContact, contacts } = useContactStore();
  const [tone, setTone] = useState<'formal' | 'casual' | 'brief'>('casual');
  const [draftContent, setDraftContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [goal, setGoal] = useState('discuss potential collaboration opportunities');

  // Get connector (first contact) and target (selected contact)
  const connector = contacts[0]; // Use first contact as connector for demo
  const target = selectedContact;

  const generateMessage = async (selectedTone: 'formal' | 'casual' | 'brief') => {
    if (!connector) {
      setDraftContent('Please select contacts to generate an introduction message.');
      return;
    }

    setIsGenerating(true);

    const path = [
      { name: 'You', company: undefined, relationship: 'self' },
      { name: connector.name, company: connector.company || undefined, relationship: 'direct contact' },
    ];

    if (target) {
      path.push({ name: target.name, company: target.company || undefined, relationship: 'target' });
    }

    const result = await pathsApi.generateMessage({
      path,
      goal,
      tone: selectedTone,
    });

    if (result.data?.message) {
      setDraftContent(result.data.message);
    } else {
      setDraftContent('Failed to generate message. Please try again.');
    }
    setIsGenerating(false);
  };

  // Generate on mount and tone change
  useEffect(() => {
    generateMessage(tone);
  }, [tone, connector?.id, target?.id]);

  const handleRegenerate = () => {
    generateMessage(tone);
  };

  return (
    <div className="bg-background-dark min-h-full flex flex-col font-display text-white">
      {/* Top Bar */}
      <nav className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <button onClick={() => onNavigate('path')} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors text-white">
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-gray-100">{t('draftRequest.title')}</h1>
        <div className="w-10"></div>
      </nav>

      <main className="flex-1 px-4 py-6 flex flex-col gap-6">
        {/* Context Visualizer */}
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold leading-tight">
            {connector && target
              ? t('draftRequest.askingIntro', { connector: connector.name?.split(' ')[0], target: target.name?.split(' ')[0] })
              : connector
              ? t('draftRequest.draftMessageTo', { name: connector.name?.split(' ')[0] })
              : t('draftRequest.draftIntroMessage')}
          </h2>
          <div className="bg-[#2c3536] p-5 rounded-2xl border border-gray-800 flex items-center justify-between relative overflow-hidden">
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

            {connector && (
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
              <div className="relative z-10 flex flex-col items-center gap-2 opacity-80">
                <div className="w-12 h-12 rounded-full border-2 border-surface-card bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center grayscale">
                  <span className="text-lg font-bold text-white">{target.name?.charAt(0)}</span>
                </div>
                <span className="text-xs font-semibold text-gray-400">{target.name?.split(' ')[0]}</span>
              </div>
            )}
          </div>
        </section>

        {/* AI Controls */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <label className="text-sm font-bold text-gray-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-primary">tune</span>
              {t('draftRequest.tone')}
            </label>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-200 text-xs font-medium">
              <span className="material-symbols-outlined text-[14px]">lightbulb</span>
              <span>{t('draftRequest.sharedHistory', { place: 'UTokyo' })}</span>
            </div>
          </div>
          
          <div className="flex p-1 bg-gray-800 rounded-xl">
            <button
              onClick={() => setTone('formal')}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${tone === 'formal' ? 'bg-[#2c3536] text-primary shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              {t('draftRequest.formal')}
            </button>
            <button
              onClick={() => setTone('casual')}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${tone === 'casual' ? 'bg-[#2c3536] text-primary shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              {t('draftRequest.casual')}
            </button>
            <button
              onClick={() => setTone('brief')}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${tone === 'brief' ? 'bg-[#2c3536] text-primary shadow-sm' : 'text-gray-400 hover:text-white'}`}
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
            ) : (
              <textarea
                className="flex-1 w-full p-4 bg-transparent border-none resize-none focus:ring-0 text-base leading-relaxed text-gray-200 font-normal placeholder-gray-600"
                spellCheck={false}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
              ></textarea>
            )}

            <div className="absolute bottom-4 right-4">
              <button
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-gray-800 border border-gray-600 shadow-sm hover:border-primary/50 text-xs font-semibold text-gray-300 px-3 py-2 rounded-full transition-all disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[16px] text-primary ${isGenerating ? 'animate-spin' : ''}`}>autorenew</span>
                {isGenerating ? t('draftRequest.generating') : t('draftRequest.regenerate')}
              </button>
            </div>
          </div>

          <div className="mt-3 px-2">
            <div className="flex items-start gap-3 text-xs text-gray-400">
              <span className="material-symbols-outlined text-[16px] text-primary mt-0.5">auto_awesome</span>
              <p>{t('draftRequest.aiGenerated')}</p>
            </div>
          </div>
        </section>
      </main>

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
            onClick={() => {
              const subject = target ? t('draftRequest.introductionTo', { name: target.name?.split(' ')[0] }).replace('?', '') : t('draftRequest.introductionRequest');
              const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draftContent)}`;
              window.open(mailtoUrl, '_blank');
            }}
            disabled={isGenerating || !draftContent}
            className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-primary text-black font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">mail</span>
            <span>{t('draftRequest.openInEmail')}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default DraftRequest;