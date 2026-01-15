import React from 'react';
import { ScreenName } from '../App';

interface VoiceMemoProps {
  onNavigate: (screen: ScreenName) => void;
}

const VoiceMemo: React.FC<VoiceMemoProps> = ({ onNavigate }) => {
  return (
    <div className="bg-background-dark min-h-full flex flex-col font-display text-white">
      {/* Top Nav */}
      <header className="flex items-center justify-between p-6">
        <button onClick={() => onNavigate('dashboard')} className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2d1b1b] border border-red-900/30 rounded-full shadow-sm">
          <span className="material-symbols-outlined text-[16px] text-red-500">lock</span>
          <span className="text-xs font-medium text-red-400 tracking-wide">Processed locally</span>
        </div>
        <button className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined">more_horiz</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="text-7xl font-bold tracking-tighter tabular-nums mb-8">01:24</div>
        <div className="flex items-center gap-2 text-primary font-medium animate-pulse mb-12">
          <div className="w-2 h-2 rounded-full bg-primary"></div>
          Recording
        </div>

        {/* Waveform */}
        <div className="h-24 w-full flex items-center justify-center gap-1 mb-12">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className={`w-1.5 rounded-full bg-primary ${i % 2 === 0 ? 'opacity-40' : 'opacity-100'}`}
              style={{ height: `${Math.random() * 100}%`, transition: 'height 0.2s ease' }}
            ></div>
          ))}
        </div>

        {/* Live Transcript Card */}
        <div className="w-full relative group">
          <div className="absolute -top-3 left-6 bg-primary text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider z-10 border border-black">
            Live Transcript
          </div>
          <div className="w-full bg-[#1c252b] rounded-xl border border-gray-800 p-6 pt-8 relative overflow-hidden">
            <p className="text-xl leading-relaxed text-gray-300 font-light">
              ...meeting went longer than expected but very productive. Met with 
              <span className="inline-flex items-center px-1.5 mx-1 rounded bg-primary/20 text-primary font-semibold border border-primary/20">Sarah Jenkins</span>
              from 
              <span className="inline-flex items-center px-1.5 mx-1 rounded bg-primary/20 text-primary font-semibold border border-primary/20">Sequoia</span>
              today. She mentioned they are looking to close the round by
              <span className="inline-flex items-center px-1.5 mx-1 rounded bg-primary/20 text-primary font-semibold border border-primary/20">Q3</span>.
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#1c252b] to-transparent pointer-events-none"></div>
          </div>
        </div>
      </main>

      {/* Controls */}
      <footer className="p-6 pb-10 flex items-center justify-between max-w-sm mx-auto w-full">
        <button onClick={() => onNavigate('dashboard')} className="flex flex-col items-center gap-2 group">
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-gray-700 transition-colors">
            <span className="material-symbols-outlined text-[28px] text-gray-400">close</span>
          </div>
          <span className="text-xs font-medium text-gray-500">Cancel</span>
        </button>

        <button className="flex flex-col items-center gap-2 group">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-[0_0_30px_rgba(57,224,121,0.4)] group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[40px] text-black">check</span>
          </div>
          <span className="text-xs font-bold text-primary">Done</span>
        </button>

        <button className="flex flex-col items-center gap-2 group">
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-gray-700 transition-colors">
            <span className="material-symbols-outlined text-[28px] text-white">pause</span>
          </div>
          <span className="text-xs font-medium text-gray-500">Pause</span>
        </button>
      </footer>
    </div>
  );
};

export default VoiceMemo;