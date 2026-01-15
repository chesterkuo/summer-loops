import React, { useState } from 'react';
import BottomNav from '../components/BottomNav';
import { ScreenName } from '../App';

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
  const [interactions, setInteractions] = useState<Interaction[]>([
    { id: 1, title: 'Coffee Chat', date: 'Nov 12', note: 'Discussed Q4 roadmap and hiring plans.', type: 'coffee' },
    { id: 2, title: 'Email: Intro to Mark', date: 'Oct 04', note: 'Sent warm intro regarding AI ethics panel.', type: 'email' }
  ]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [newInteraction, setNewInteraction] = useState({ title: 'Quick Catchup', note: '', type: 'coffee' });

  // Menu & Locale State
  const [showMenu, setShowMenu] = useState(false);
  const [locale, setLocale] = useState<string>('en');

  const handleAddInteraction = () => {
    if (!newInteraction.title) return;
    
    const newItem: Interaction = {
      id: Date.now(),
      title: newInteraction.title,
      date: 'Today',
      note: newInteraction.note,
      type: newInteraction.type
    };

    setInteractions([newItem, ...interactions]);
    setShowAddModal(false);
    setNewInteraction({ title: 'Quick Catchup', note: '', type: 'coffee' });
  };

  const languages = [
    { id: 'en', label: 'English', flag: '🇺🇸' },
    { id: 'zh', label: '中文', flag: '🇨🇳' },
    { id: 'jp', label: '日本語', flag: '🇯🇵' },
    { id: 'ko', label: '한국어', flag: '🇰🇷' },
    { id: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
    { id: 'th', label: 'ไทย', flag: '🇹🇭' }
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
                   Relationship Analysis
                </h3>
                <button onClick={() => setShowAnalysisModal(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
                   <span className="material-symbols-outlined">close</span>
                </button>
             </div>

             {/* Connection Score */}
             <div className="mb-8">
                <div className="flex justify-between mb-2 items-end">
                   <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Connection Strength</span>
                   <span className="text-xl font-bold text-primary">85<span className="text-sm text-gray-500">/100</span></span>
                </div>
                <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                   <div className="h-full bg-gradient-to-r from-primary/40 via-primary to-accent w-[85%] rounded-full shadow-[0_0_10px_rgba(57,224,121,0.3)]"></div>
                </div>
                <p className="mt-2 text-xs text-gray-400">Top 5% of your professional network.</p>
             </div>

             {/* Communication Pattern */}
             <div className="mb-8">
                <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                   <span className="material-symbols-outlined text-gray-400 text-[16px]">bar_chart</span>
                   Interaction Rhythm
                </h4>
                <div className="flex items-end justify-between h-32 gap-3 px-2">
                    {[35, 45, 25, 65, 85, 50].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end group h-full">
                            <div className="w-full bg-gray-700/50 rounded-t-sm relative group-hover:bg-primary/80 transition-all duration-300" style={{ height: `${h}%` }}>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-dark border border-gray-600 text-[10px] font-bold text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                   {h} Interactions
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
                         <span className="text-xs font-bold text-white uppercase tracking-wide">Best Time</span>
                     </div>
                     <p className="text-sm text-gray-300 font-medium">Tuesday & Thursday mornings (9-11 AM)</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-400/30 transition-colors">
                     <div className="flex items-center gap-2 mb-2">
                         <span className="material-symbols-outlined text-blue-400 text-[18px]">forum</span>
                         <span className="text-xs font-bold text-white uppercase tracking-wide">Preferred Channel</span>
                     </div>
                     <p className="text-sm text-gray-300 font-medium">Responds fastest to <span className="text-white font-bold">email</span> for work topics.</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-pink-400/30 transition-colors">
                     <div className="flex items-center gap-2 mb-2">
                         <span className="material-symbols-outlined text-pink-400 text-[18px]">topic</span>
                         <span className="text-xs font-bold text-white uppercase tracking-wide">Top Topics</span>
                     </div>
                     <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 rounded-md bg-pink-500/10 text-pink-300 text-[10px] font-bold border border-pink-500/20">FinTech</span>
                        <span className="px-2 py-1 rounded-md bg-pink-500/10 text-pink-300 text-[10px] font-bold border border-pink-500/20">AI Ethics</span>
                        <span className="px-2 py-1 rounded-md bg-pink-500/10 text-pink-300 text-[10px] font-bold border border-pink-500/20">Hiring</span>
                     </div>
                 </div>
             </div>
             
             <button onClick={() => setShowAnalysisModal(false)} className="w-full py-3.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-sm transition-colors shadow-lg">
                Close Analysis
             </button>
          </div>
        </div>
      )}

      {/* Add Interaction Modal */}
      {showAddModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-sm rounded-2xl p-5 border border-white/10 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Log Interaction</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Interaction Type</label>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                   {['Coffee', 'Call', 'Email', 'Meeting'].map(t => (
                     <button 
                       key={t}
                       onClick={() => setNewInteraction({ ...newInteraction, type: t.toLowerCase(), title: t })}
                       className={`px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap transition-colors ${newInteraction.type === t.toLowerCase() ? 'bg-primary text-black border-primary' : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-500'}`}
                     >
                       {t}
                     </button>
                   ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Title</label>
                <input 
                  value={newInteraction.title} 
                  onChange={e => setNewInteraction({ ...newInteraction, title: e.target.value })}
                  className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors" 
                  placeholder="e.g. Quick Catchup"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Notes</label>
                <textarea 
                  value={newInteraction.note}
                  onChange={e => setNewInteraction({ ...newInteraction, note: e.target.value })}
                  className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none h-24 resize-none transition-colors" 
                  placeholder="What did you discuss?"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowAddModal(false)} 
                className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddInteraction} 
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-black text-sm font-bold transition-colors shadow-lg shadow-primary/20"
              >
                Save
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
               <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Quick Jump</h4>
               <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => { onNavigate('dashboard'); setShowMenu(false); }} className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors gap-1 group border border-white/5 hover:border-white/10">
                    <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">home</span>
                    <span className="text-[10px] font-medium text-gray-300">Home</span>
                 </button>
                 <button onClick={() => { onNavigate('map'); setShowMenu(false); }} className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors gap-1 group border border-white/5 hover:border-white/10">
                    <span className="material-symbols-outlined text-blue-400 group-hover:scale-110 transition-transform">hub</span>
                    <span className="text-[10px] font-medium text-gray-300">Map</span>
                 </button>
                 <button onClick={() => { onNavigate('scan'); setShowMenu(false); }} className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors gap-1 group border border-white/5 hover:border-white/10">
                    <span className="material-symbols-outlined text-purple-400 group-hover:scale-110 transition-transform">qr_code_scanner</span>
                    <span className="text-[10px] font-medium text-gray-300">Scan</span>
                 </button>
                 <button onClick={() => { onNavigate('path'); setShowMenu(false); }} className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors gap-1 group border border-white/5 hover:border-white/10">
                    <span className="material-symbols-outlined text-accent group-hover:scale-110 transition-transform">insights</span>
                    <span className="text-[10px] font-medium text-gray-300">Path</span>
                 </button>
               </div>
             </div>
             
             <div>
               <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Language</h4>
               <div className="grid grid-cols-3 gap-2">
                 {languages.map((lang) => (
                    <button 
                       key={lang.id}
                       onClick={() => setLocale(lang.id)}
                       className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all active:scale-95 ${locale === lang.id ? 'bg-primary/20 border-primary text-white shadow-sm' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:text-gray-200'}`}
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
        {/* Profile Hero */}
        <div className="flex flex-col items-center mt-2">
          <div className="relative group">
            <div 
              className="bg-center bg-no-repeat bg-cover rounded-full h-28 w-28 shadow-lg border-2 border-background-dark mb-4" 
              style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuB7INbEN-uOZSJCGt7KfKu3yoAOMT3ykcHtrCqQLooWzY4k4Qd0Ruo3PPt2sGrd0rXB1v5qxKbNV4DKy7hvjdcuhjM8CuPTt4vjxtT3MXfheG2GoQa48q_VXb-tEodloTKZbr6vwCrUCp-2_Nv5osFapHihzM4Q5MPx1nQka0cBfu8AdUqjskqadCWL-IBSwjRpNP-NhwZW7qInUaHLQREI7YyBUZV7aC8SorvDepu6GIKHzI23oZF9DLssH0giqrmsFnGIq2Kc4xzaf")' }}
            ></div>
            <div className="absolute bottom-4 right-0 bg-accent rounded-full p-1.5 border-4 border-background-dark shadow-sm">
              <span className="material-symbols-outlined text-black text-[16px] font-bold">bolt</span>
            </div>
          </div>
          <div className="flex flex-col items-center text-center gap-1">
            <h1 className="text-white text-2xl font-extrabold tracking-tight">Sarah Jenkins</h1>
            <p className="text-text-muted text-sm font-medium">VP of Product at Solaris Tech</p>
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <span className="material-symbols-outlined text-[14px]">location_on</span>
              <span>San Francisco, CA</span>
            </div>
          </div>
          {/* Meter */}
          <div className="mt-5 flex flex-col items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-2 w-8 rounded-full bg-accent shadow-[0_0_8px_rgba(252,217,107,0.4)]"></div>
              <div className="h-2 w-8 rounded-full bg-accent shadow-[0_0_8px_rgba(252,217,107,0.4)]"></div>
              <div className="h-2 w-8 rounded-full bg-accent shadow-[0_0_8px_rgba(252,217,107,0.4)]"></div>
              <div className="h-2 w-8 rounded-full bg-accent shadow-[0_0_8px_rgba(252,217,107,0.4)]"></div>
              <div className="h-2 w-8 rounded-full bg-white/10"></div>
            </div>
            <span className="text-[10px] font-bold text-accent tracking-widest uppercase mt-1">Strong Connection</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onNavigate('path')} className="flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-black font-bold text-sm shadow-sm hover:bg-primary-dark active:scale-[0.98] transition-all">
            <span className="material-symbols-outlined text-[20px]">alt_route</span>
            Find Path
          </button>
          <button onClick={() => onNavigate('draft')} className="flex items-center justify-center gap-2 h-12 rounded-xl bg-[#2C3435] border border-gray-700 text-white font-bold text-sm hover:bg-gray-700 active:scale-[0.98] transition-all">
            <span className="material-symbols-outlined text-[20px]">edit_note</span>
            Draft Intro
          </button>
        </div>

        {/* Insight Card */}
        <div className="bg-surface-card p-6 rounded-2xl shadow-sm border border-white/5 relative overflow-hidden group min-h-[220px] flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                <span className="material-symbols-outlined icon-filled text-[18px]">auto_awesome</span>
                </div>
                <h3 className="font-bold text-white text-base">Summer Loop Insight</h3>
            </div>
            <p className="text-gray-300 text-[15px] leading-relaxed">
                Sarah is a key node in the FinTech space. You last spoke <span className="font-bold text-white">3 months ago</span> about AI ethics. She responds best to brief, actionable emails on <span className="font-bold text-white">Tuesday mornings</span>.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              <span>Private to you</span>
            </div>
            <button 
              onClick={() => setShowAnalysisModal(true)} 
              className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
                View Analysis 
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* History */}
        <div className="bg-surface-card p-5 rounded-2xl shadow-sm border border-white/5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest">Recent Interactions</h3>
            <button 
              onClick={() => setShowAddModal(true)}
              className="size-8 flex items-center justify-center rounded-full hover:bg-white/10 text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>
          <div className="relative pl-1 space-y-6">
            <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-white/5"></div>
            
            {interactions.map((interaction) => (
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
            ))}

          </div>
        </div>
      </div>
      <BottomNav active="profile" onNavigate={onNavigate} />
    </div>
  );
};

export default Profile;