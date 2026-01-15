import React, { useState } from 'react';
import BottomNav from '../components/BottomNav';
import { ScreenName } from '../App';

interface PathDiscoveryProps {
  onNavigate: (screen: ScreenName) => void;
}

const PathDiscovery: React.FC<PathDiscoveryProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState("Dr. Wei Zhang");

  return (
    <div className="flex flex-col h-full bg-background-dark font-display text-white overflow-hidden relative">
      {/* Header */}
      <header className="flex items-center px-6 py-4 justify-between bg-background-dark/95 backdrop-blur-sm sticky top-0 z-20 shrink-0 border-b border-white/5">
        <button 
          onClick={() => onNavigate('dashboard')} 
          className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-2xl text-white">arrow_back</span>
        </button>
        <h2 className="text-white text-lg font-bold">Path Discovery</h2>
        <div className="size-10"></div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        <main className="flex flex-col gap-6 p-6">
          {/* Search Input */}
          <div className="relative group">
            <div className="flex h-14 w-full items-center rounded-2xl bg-surface-card border border-transparent group-focus-within:border-primary/50 group-focus-within:ring-2 group-focus-within:ring-primary/20 px-4 gap-3 transition-all shadow-lg">
              <span className="material-symbols-outlined text-primary group-focus-within:scale-110 transition-transform">search</span>
              <input 
                className="bg-transparent border-none text-white text-base font-medium w-full focus:ring-0 outline-none placeholder:text-gray-500" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a person or company..."
              />
              <button className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                 <span className="material-symbols-outlined">tune</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-1 mt-2">
            <div>
              <span className="text-xs font-bold tracking-wider text-primary uppercase block mb-1 animate-pulse">Best Route Found</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">Introduction Path</h2>
            </div>
            <div className="flex gap-1.5 bg-surface-card p-1 rounded-full border border-white/10">
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(57,224,121,0.6)]"></span>
              <span className="w-2 h-2 rounded-full bg-gray-600"></span>
            </div>
          </div>

          {/* Path Visualizer */}
          <div className="w-full overflow-x-auto no-scrollbar py-4 -mx-6 px-6">
            <div className="flex items-center min-w-full justify-between gap-2">
              {/* You */}
              <div className="flex flex-col items-center gap-3 shrink-0 relative group">
                <div className="absolute -inset-3 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors"></div>
                <div className="w-20 h-20 rounded-full p-1 border-2 border-dashed border-primary/30 relative bg-background-dark z-10">
                  <div className="w-full h-full rounded-full bg-cover bg-center" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBAXombEDKVZVhYuI4gSNo5xVQ22L1XSnGXbGzTCOR5TknhOZkv2edPmV5Wlg8o12Ga51sbZXlL1tB_4AM7F2Gh3953wpa5pClz6DL2qfe5TpxijEnrMGYcYsiiLEZTxhe0h7kXEyeXzjtgMpAgV48eCspG9Dnrew9m_49g-fiPrD5hyQOb8VNrzhdLe-LP3X7HyYL7KqgJ7QIIYsz5Yq-PC4DrMi2r8H_mayPMgkOlBKkSmjRYH3_rmwZj9h_g_VtFULYoagoxtV6s")' }}></div>
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-surface-card px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-gray-700 text-gray-300 shadow-sm">YOU</div>
                </div>
                <div className="text-center z-10">
                  <p className="text-sm font-bold text-white">Alex</p>
                  <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wide">Designer</p>
                </div>
              </div>

              {/* Connector 1 */}
              <div className="flex-1 min-w-[60px] h-[2px] bg-gradient-to-r from-primary/30 via-primary to-primary/30 relative mx-1 self-center mb-8">
                 <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center animate-fade-in-up">
                   <div className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-[0_0_10px_rgba(234,179,8,0.2)] mb-1">
                     85% Match
                   </div>
                   <span className="material-symbols-outlined text-primary text-[14px]">arrow_forward</span>
                 </div>
              </div>

              {/* Intermediary */}
              <div className="flex flex-col items-center gap-3 shrink-0 relative group cursor-pointer" onClick={() => onNavigate('profile')}>
                <div className="absolute -inset-4 bg-primary/10 rounded-2xl blur-xl group-hover:bg-primary/20 transition-colors"></div>
                <div className="relative z-10">
                  <div className="w-24 h-24 rounded-2xl bg-surface-card p-1 shadow-[0_0_20px_rgba(57,224,121,0.2)] border border-primary ring-2 ring-primary/20 group-hover:scale-105 transition-transform duration-300">
                    <img className="w-full h-full rounded-xl object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB_j688VjSGiEJ7yGmsOhqWOEOFXljBOV19pn6KKMWRZfqkCRc2Z_gx3ykqOslkZWKkIJegDW6uxglxayw_BvC3V46f-ZFTfVMI0l7rcYIDT2bV8RsoiiUsy7WqF257X_32aJkDzukxxIwj1-gc-n4oCZUuOSGJ2606e29hKfSUtShHGv1lDDK_xiSNff5M_e0YjjujdMcd4Gh1QeONgt2j0WX3WJwjlMQQBSWgswe97-D_IimRX4e_UtkOvoj6evni-08CF2V5okKO" alt="Sarah" />
                  </div>
                  <div className="absolute -top-3 -right-3 bg-primary text-black p-1.5 rounded-full border-4 border-background-dark shadow-lg">
                    <span className="material-symbols-outlined text-[16px] font-bold block">star</span>
                  </div>
                </div>
                <div className="text-center z-10">
                  <p className="text-base font-bold text-white group-hover:text-primary transition-colors">Sarah Chen</p>
                  <p className="text-primary text-[10px] font-bold uppercase tracking-wide bg-primary/10 px-2 py-0.5 rounded-full inline-block mt-0.5">Connector</p>
                </div>
              </div>

              {/* Connector 2 */}
              <div className="flex-1 min-w-[60px] h-[2px] bg-gray-700 relative mx-1 self-center mb-8">
                 <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                   <span className="material-symbols-outlined text-gray-600 text-[14px]">lock</span>
                 </div>
              </div>

              {/* Target */}
              <div className="flex flex-col items-center gap-3 shrink-0 opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
                <div className="w-20 h-20 rounded-full border-2 border-gray-600 bg-gray-800 p-1 relative">
                  <img className="w-full h-full rounded-full object-cover grayscale" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBu7VDSYguVlpGh21bzlPIUakVSJd8X78uiRTPJC9_i-yQddtzWfNOaSLHWCMkX37PQdxqQRdgfiqWAigZF4SX5Zoj5Uprv-sBC0EQHykI-L69-MG6vD4W5EMOzKLjFZrNoN65hxiRsDFCg_YGU8aoT5iH8vgQZcwZjMIze--Bew567lFVhmrDXh8COuOQki3uNk_-EAXyhQy6SGYjKtq3_3TAW69NjYBTAc6Ulix7JVRYcL-wJtIwPS9KXWtXf-eQMPgyFIIXyp-dC" alt="Wei" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">Dr. Wei Zhang</p>
                  <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wide">Head of AI</p>
                </div>
              </div>
            </div>
          </div>

          {/* Insight Panel */}
          <div className="bg-surface-card rounded-2xl p-6 border border-white/5 relative overflow-hidden group hover:border-primary/20 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/15 transition-colors"></div>
            <div className="relative z-10">
              <div className="flex items-start gap-4 mb-4">
                <div className="bg-primary/10 p-3 rounded-xl text-primary shrink-0 border border-primary/10">
                  <span className="material-symbols-outlined icon-filled">lightbulb</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight mb-1">Why Sarah is your best bet</h3>
                  <p className="text-xs text-green-400 font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">trending_up</span>
                    High response likelihood
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed font-light">
                You and Sarah both attended <span className="font-bold text-white border-b border-white/20">Stanford University</span> during the same period (2011-2015). Additionally, she worked directly with Wei for <span className="font-bold text-white">3 years</span> at her previous company.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-dark border border-gray-700 text-xs font-medium text-gray-300">
                  <span className="material-symbols-outlined text-[16px] text-accent">school</span> Class of 2015
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-dark border border-gray-700 text-xs font-medium text-gray-300">
                  <span className="material-symbols-outlined text-[16px] text-blue-400">calendar_month</span> 3y Overlap
                </span>
                 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-dark border border-gray-700 text-xs font-medium text-gray-300">
                  <span className="material-symbols-outlined text-[16px] text-pink-400">group</span> Mutuals: 12
                </span>
              </div>
            </div>
          </div>

          {/* Alternative Paths (Added to fill "Not fully implemented") */}
          <div className="mt-2">
            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-500 text-[18px]">alt_route</span>
              Alternative Paths
            </h3>
            <div className="flex flex-col gap-3">
               {/* Alt Path 1 */}
               <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-card border border-transparent hover:border-gray-700 transition-colors">
                  <div className="flex -space-x-2 overflow-hidden">
                    <img className="inline-block size-8 rounded-full ring-2 ring-background-dark object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCy1iKUC8i5H9EXoabAb3ciF_JJYdeJyBkL4hL3d_D16-w_ny3f7gb8rtLTbt5wiwXEo2l5yRPB8Kp20ncKSJcoHoyJOrVS7rhS1fpcxmD08JC93oSQXNnmSuonjKd7TBRyfhYFwfm4JvIsg0Te1J1_lwEIAefHwYw97aoxH9EfNR4TSDhfKfi73nFowiBIVc7e7SZ_z8fMsLYOsFKBXQ6Gxzzh9MNDABCf7ubhsjHdqlANyEpOIXASKOOvSC8nC8_piApmdclc8NHf" alt="Alt" />
                    <img className="inline-block size-8 rounded-full ring-2 ring-background-dark object-cover grayscale" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfvKukurdN39N5zKyre4x9vdl5o0oriTTLjV_zA8iXUBTYnSyZibrG4870uYpwJBWxuRbzuNvmNEzwM289knGwW1JkEwYVpQm05xeunE7DqX_e40x7FP3nBDxkZG181f6_YH84G5VjWEqTmCjRB7-pE4AlnMTfskFN3D48NAH4XcJiHPbsLJtMxH0Ou4zjzuYHG-mBm1_bLGPWIigyUrbhAq2hwa4HAZ7p3z7IYHR5H7fP_bHkSaOURJYNzpQQPr8DQp08g5mPh4wH" alt="Alt2" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Via David Miller</span>
                      <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 rounded font-bold">Medium</span>
                    </div>
                    <p className="text-xs text-gray-500">Strong connection, but less domain overlap.</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-600">chevron_right</span>
               </div>
               
               {/* Alt Path 2 */}
               <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-card border border-transparent hover:border-gray-700 transition-colors">
                  <div className="flex -space-x-2 overflow-hidden">
                    <img className="inline-block size-8 rounded-full ring-2 ring-background-dark object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBKyg2X_Pn4Qa_rcV_0CxlmA1vF-cgkjzOLnm42qbygn0smiLfck-AVdPT4oe1DHZVLN-Hw12yG2G5tMpxVGSLDN-dFIplb99QbYE7evxFu3eREVARut3VyctT3PA6yU5PmVloA8zxavI5XWdDLD2wCz7u5amyBa1qFiyuhcKZJCnhpWImo7i8UWkeE5U7oXhht9czmPukbp__ef_jP2lrOEKjPINBDqWcBS3jRSNnhJm6AHBRBvlluExrybKKbdzGxfgvHO9obH3x_" alt="Alt" />
                    <img className="inline-block size-8 rounded-full ring-2 ring-background-dark object-cover grayscale" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBwWrT_a6sfjIhRkQU9N6FMIUd00i_S6fqEYWtstndo0CJ-VYC_Ti4MJYZ3iYKAUSd1yvgbtxfJmFNGvHOYERwInm9yrKTQ7jXaefa7XgRraMhHHGsUou-TWu7j_WJc1atteDKn44uNyucVaofegV2aM-vJUwRpfRweEft5tQHUeuRVypkBjFs0wS61UQlVzbnANTokMgT57PeuOSveU49UT6AmQDzhGACbxGD8AOPFUXu8ikksVykxek49KGpXaM1a9mIekzVz56qQ" alt="Alt2" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Via Kenji + Lisa</span>
                      <span className="text-[10px] bg-red-500/20 text-red-500 px-1.5 rounded font-bold">Weak</span>
                    </div>
                    <p className="text-xs text-gray-500">Longer path, higher friction.</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-600">chevron_right</span>
               </div>
            </div>
          </div>
        </main>
      </div>

      {/* Action Bar */}
      <div className="p-6 bg-[#181d20] border-t border-gray-800 z-10 shrink-0 mb-safe-bottom">
        <div className="flex justify-between items-center mb-3 px-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Success Probability</span>
          <span className="text-sm font-bold text-primary">High (78%)</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 mb-5 overflow-hidden">
          <div className="bg-primary h-full rounded-full animate-pulse" style={{ width: '78%' }}></div>
        </div>
        <button 
          onClick={() => onNavigate('draft')} 
          className="w-full bg-primary hover:bg-primary-dark text-black font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(57,224,121,0.3)] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined icon-filled">edit_note</span>
          Draft Intro Request
        </button>
      </div>

      {/* Bottom Nav */}
      <BottomNav active="insights" onNavigate={onNavigate} />
    </div>
  );
};

export default PathDiscovery;