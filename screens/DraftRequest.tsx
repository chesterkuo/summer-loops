import React, { useState, useEffect } from 'react';
import { ScreenName } from '../App';

interface DraftRequestProps {
  onNavigate: (screen: ScreenName) => void;
}

const DraftRequest: React.FC<DraftRequestProps> = ({ onNavigate }) => {
  const [tone, setTone] = useState<'formal' | 'casual' | 'brief'>('casual');
  const [draftContent, setDraftContent] = useState('');

  const drafts = {
    formal: `Dear Sarah,\n\nI trust this message finds you well.\n\nI observed that you are connected with Mr. Kenji Tanaka, likely through your shared alumni network at the University of Tokyo. Given his significant contributions to the Fintech sector, I am very interested in establishing a professional connection to explore potential collaboration opportunities regarding my current initiative.\n\nWould you be willing to facilitate an introduction? I would greatly appreciate your assistance.\n\nSincerely,\nAlex Morgan`,
    casual: `Hi Sarah,\n\nHope you're doing well!\n\nI noticed you're connected with Kenji Tanaka from your time at University of Tokyo. I've been following his work in Fintech for a while and would love to connect with him to discuss potential synergies with my current project.\n\nWould you be open to making a quick intro? No pressure at all if not!\n\nBest,\nAlex`,
    brief: `Hi Sarah,\n\nHope you're good. Saw you know Kenji Tanaka from UTokyo.\n\nI'm working on a project that aligns with his Fintech work and would love to chat with him. Could you intro us?\n\nThanks,\nAlex`
  };

  useEffect(() => {
    setDraftContent(drafts[tone]);
  }, [tone]);

  return (
    <div className="bg-background-dark min-h-full flex flex-col font-display text-white">
      {/* Top Bar */}
      <nav className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <button onClick={() => onNavigate('path')} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors text-white">
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-gray-100">Draft Request</h1>
        <div className="w-10"></div>
      </nav>

      <main className="flex-1 px-4 py-6 flex flex-col gap-6">
        {/* Context Visualizer */}
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold leading-tight">Asking Sarah for an intro to Kenji</h2>
          <div className="bg-[#2c3536] p-5 rounded-2xl border border-gray-800 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-gray-700 -translate-y-[14px] z-0"></div>
            <div className="absolute top-1/2 left-10 w-1/2 h-0.5 bg-primary/30 -translate-y-[14px] z-0"></div>
            
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full border-2 border-surface-card bg-gray-100 overflow-hidden">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_k6kwcXyBsFkwwZflExJGzSlZVHIfStSRHHCMGmPjgLIMzDboXq_Bl_Cw3bHEl85WiB9UVZ8cjTwHy0NbyJEbgGlAhLI7BidORhPmmYWi4zAH5E9AAVpvw2r4JIPJpSs4flZ-JguXTCGuwLaUbBb21aJUhSdUwmUkbX3ckO3wEz4BAadXN5vJ4Z8f2lvJMoiNnHfqlYSWfaDoTP6hr6R6sdL0XNLW5QjewBAgrlQ6UIM0IFfYpTNTqVHeYWRGM7Vd9wfA4fkrO9Xt" alt="You" />
              </div>
              <span className="text-xs font-semibold text-gray-400">You</span>
            </div>

            <div className="relative z-10 bg-[#2c3536] p-1 rounded-full text-gray-500">
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full border-2 border-primary overflow-hidden ring-4 ring-primary/10">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBkgudeKKMqijedY7fsVW2uNlRDHV9WGBAaQDVKGRf9Js40vGIFCS40dxkHapeWjxxeL-bHajUPxoKVpSURLTMMIfp0ZKQuGGCCq0jJlCwIdoWdm_iil5m0bnr_AH1qLtaU-SF_XR-9seVpOefZSoGkieuzsbJatSwM7CmtHf_oWrtqbTaAPILb-3Vh58g4XT-cVUQL4ixCrAiG_2MwHCco_s8cSc3iqzFe4bpC074ZhAWPpFoVEYoyVqvd-COS6724h0UyacfJhYU9" alt="Sarah" />
              </div>
              <span className="text-xs font-bold text-primary">Sarah</span>
            </div>

            <div className="relative z-10 bg-[#2c3536] p-1 rounded-full text-gray-500">
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2 opacity-80">
              <div className="w-12 h-12 rounded-full border-2 border-surface-card bg-gray-100 overflow-hidden grayscale">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBKyg2X_Pn4Qa_rcV_0CxlmA1vF-cgkjzOLnm42qbygn0smiLfck-AVdPT4oe1DHZVLN-Hw12yG2G5tMpxVGSLDN-dFIplb99QbYE7evxFu3eREVARut3VyctT3PA6yU5PmVloA8zxavI5XWdDLD2wCz7u5amyBa1qFiyuhcKZJCnhpWImo7i8UWkeE5U7oXhht9czmPukbp__ef_jP2lrOEKjPINBDqWcBS3jRSNnhJm6AHBRBvlluExrybKKbdzGxfgvHO9obH3x_" alt="Kenji" />
              </div>
              <span className="text-xs font-semibold text-gray-400">Kenji</span>
            </div>
          </div>
        </section>

        {/* AI Controls */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <label className="text-sm font-bold text-gray-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-primary">tune</span>
              Tone
            </label>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-200 text-xs font-medium">
              <span className="material-symbols-outlined text-[14px]">lightbulb</span>
              <span>Shared history at UTokyo</span>
            </div>
          </div>
          
          <div className="flex p-1 bg-gray-800 rounded-xl">
            <button 
              onClick={() => setTone('formal')}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${tone === 'formal' ? 'bg-[#2c3536] text-primary shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              Formal
            </button>
            <button 
              onClick={() => setTone('casual')}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${tone === 'casual' ? 'bg-[#2c3536] text-primary shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              Casual
            </button>
            <button 
              onClick={() => setTone('brief')}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${tone === 'brief' ? 'bg-[#2c3536] text-primary shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              Brief
            </button>
          </div>
        </section>

        {/* Editor */}
        <section className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-b from-primary/10 to-transparent rounded-2xl opacity-50 blur-sm pointer-events-none"></div>
          <div className="relative bg-[#2c3536] rounded-xl overflow-hidden flex flex-col min-h-[320px]">
            <div className="border-b border-gray-700 p-4 pb-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Subject</span>
                <input className="bg-transparent text-sm font-semibold text-gray-100 w-full focus:outline-none" type="text" value="Intro to Kenji?" readOnly />
              </div>
            </div>
            <textarea 
              className="flex-1 w-full p-4 bg-transparent border-none resize-none focus:ring-0 text-base leading-relaxed text-gray-200 font-normal placeholder-gray-600" 
              spellCheck={false} 
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
            ></textarea>
            
            <div className="absolute bottom-4 right-4">
              <button 
                onClick={() => setDraftContent(drafts[tone])}
                className="flex items-center gap-2 bg-gray-800 border border-gray-600 shadow-sm hover:border-primary/50 text-xs font-semibold text-gray-300 px-3 py-2 rounded-full transition-all"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">autorenew</span>
                Regenerate
              </button>
            </div>
          </div>
          
          <div className="mt-3 px-2">
            <div className="flex items-start gap-3 text-xs text-gray-400">
              <span className="material-symbols-outlined text-[16px] text-primary mt-0.5">check_circle</span>
              <p>This draft references your <span className="text-gray-200 font-medium">shared alumni status</span> to build immediate trust.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 w-full bg-background-dark/95 backdrop-blur-xl border-t border-gray-800 pb-safe pt-4 px-6 z-40">
        <div className="max-w-md mx-auto w-full flex gap-3 pb-6">
          <button className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl border border-primary/30 text-primary font-bold hover:bg-primary/5 transition-colors">
            <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
            <span>Copy to LINE</span>
          </button>
          <button className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-primary text-black font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all">
            <span className="material-symbols-outlined text-[20px]">mail</span>
            <span>Copy to Email</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default DraftRequest;