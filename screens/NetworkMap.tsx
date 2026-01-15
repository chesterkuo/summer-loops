import React, { useState, useRef, useEffect } from 'react';
import { ScreenName } from '../App';

interface NetworkMapProps {
  onNavigate: (screen: ScreenName) => void;
}

const NetworkMap: React.FC<NetworkMapProps> = ({ onNavigate }) => {
  // Zoom & Pan State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  
  // Refs for gesture handling
  const lastPos = useRef({ x: 0, y: 0 });
  const startPinchDist = useRef<number | null>(null);
  const startScale = useRef<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    degrees: ['1st', '2nd'],
    industries: ['Tech', 'Finance'],
    showDormant: false
  });

  // --- Gesture Handlers ---

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag if not touching a button or interactive element
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastPos.current.x;
    const deltaY = e.clientY - lastPos.current.y;

    setTransform(prev => ({
      ...prev,
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));

    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const scaleFactor = 0.001;
    const delta = -e.deltaY * scaleFactor;
    const newScale = Math.min(Math.max(0.5, transform.scale + delta), 4);
    
    setTransform(prev => ({
      ...prev,
      scale: newScale
    }));
  };

  // Touch Pinch Zoom Logic
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      startPinchDist.current = dist;
      startScale.current = transform.scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && startPinchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / startPinchDist.current;
      const newScale = Math.min(Math.max(0.5, startScale.current * ratio), 4);
      
      setTransform(prev => ({
        ...prev,
        scale: newScale
      }));
    }
  };

  const handleTouchEnd = () => {
    startPinchDist.current = null;
  };

  const toggleFilter = (category: keyof typeof filters, value: string) => {
    // @ts-ignore
    setFilters(prev => {
        const current = prev[category];
        if (Array.isArray(current)) {
            return {
                ...prev,
                [category]: current.includes(value) 
                    ? current.filter(i => i !== value)
                    : [...current, value]
            };
        }
        return prev;
    });
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#101323] overflow-hidden text-white font-display">
      
      {/* --- Header --- */}
      <header className="absolute top-0 left-0 right-0 z-40 px-4 pt-4 pb-2 flex justify-between items-start pointer-events-none">
        <button onClick={() => onNavigate('dashboard')} className="pointer-events-auto flex items-center justify-center size-10 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-white/10 transition-colors border border-white/10">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="pointer-events-auto flex flex-col items-center pt-2">
          <h1 className="text-white text-base font-bold tracking-wide uppercase opacity-80">Network Universe</h1>
          <p className="text-primary text-xs font-medium">142 Connections</p>
        </div>
        <button 
          onClick={() => setShowFilters(true)}
          className="pointer-events-auto flex items-center justify-center size-10 rounded-full bg-primary text-black hover:bg-primary-dark transition-all shadow-[0_0_15px_rgba(57,224,121,0.4)] active:scale-90"
        >
          <span className="material-symbols-outlined text-[20px] font-bold">tune</span>
        </button>
      </header>

      {/* --- Filter Modal Overlay --- */}
      {showFilters && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-fade-in">
           <div 
             className="bg-[#1c252b] rounded-t-3xl border-t border-white/10 p-6 shadow-2xl animate-slide-up"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">filter_list</span>
                    Network Filters
                 </h2>
                 <button onClick={() => setShowFilters(false)} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white">
                    <span className="material-symbols-outlined">close</span>
                 </button>
              </div>

              <div className="space-y-6">
                 {/* Degrees */}
                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Connection Degree</label>
                    <div className="flex gap-2">
                       {['1st', '2nd', '3rd+'].map(deg => (
                          <button 
                            key={deg}
                            onClick={() => toggleFilter('degrees', deg)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                                filters.degrees.includes(deg) 
                                ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20' 
                                : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            {deg}
                          </button>
                       ))}
                    </div>
                 </div>

                 {/* Industries */}
                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Industries</label>
                    <div className="flex flex-wrap gap-2">
                       {['Tech', 'Finance', 'Creative', 'Health', 'Education'].map(ind => (
                          <button 
                            key={ind}
                            onClick={() => toggleFilter('industries', ind)}
                            className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                                filters.industries.includes(ind) 
                                ? 'bg-white text-black border-white' 
                                : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            {ind}
                          </button>
                       ))}
                    </div>
                 </div>

                 {/* Toggles */}
                 <div className="flex items-center justify-between py-2 border-t border-white/5 mt-2">
                    <span className="text-sm font-medium text-white">Show Dormant Connections</span>
                    <div 
                        onClick={() => setFilters(prev => ({...prev, showDormant: !prev.showDormant}))}
                        className={`w-12 h-7 rounded-full relative cursor-pointer transition-colors ${filters.showDormant ? 'bg-primary' : 'bg-gray-700'}`}
                    >
                        <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${filters.showDormant ? 'translate-x-5' : ''}`}></div>
                    </div>
                 </div>

                 <button 
                    onClick={() => setShowFilters(false)}
                    className="w-full bg-primary text-black font-bold py-4 rounded-xl hover:bg-primary-dark transition-colors mt-4"
                 >
                    Apply Filters
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- Interactive Map Container --- */}
      <div 
        ref={containerRef}
        className="absolute inset-0 z-0 cursor-move touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Transformable World */}
        <div 
            className="w-full h-full origin-center will-change-transform"
            style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
        >
            {/* Background Grid */}
            <div 
                className="absolute -inset-[200%] opacity-20 pointer-events-none" 
                style={{ 
                    backgroundImage: 'radial-gradient(#2e5bff 1px, transparent 1px)', 
                    backgroundSize: '40px 40px',
                    left: '-50%', top: '-50%'
                }}
            ></div>
            
            {/* Center Helper to keep content centered initially */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative pointer-events-auto">
                    {/* Central Node (Me) */}
                    <div className="relative z-20 flex flex-col items-center">
                        <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping scale-150"></div>
                        <div className="relative size-20 rounded-full p-1 bg-[#101323] ring-2 ring-primary shadow-[0_0_30px_rgba(57,224,121,0.3)]">
                            <img className="w-full h-full rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCy1iKUC8i5H9EXoabAb3ciF_JJYdeJyBkL4hL3d_D16-w_ny3f7gb8rtLTbt5wiwXEo2l5yRPB8Kp20ncKSJcoHoyJOrVS7rhS1fpcxmD08JC93oSQXNnmSuonjKd7TBRyfhYFwfm4JvIsg0Te1J1_lwEIAefHwYw97aoxH9EfNR4TSDhfKfi73nFowiBIVc7e7SZ_z8fMsLYOsFKBXQ6Gxzzh9MNDABCf7ubhsjHdqlANyEpOIXASKOOvSC8nC8_piApmdclc8NHf" alt="Me" />
                        </div>
                        <span className="mt-2 text-xs font-bold bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/10">Me</span>
                    </div>

                    {/* Connected Node 1 (Sarah) */}
                    <div className="absolute top-[-140px] right-[-140px] z-20 flex flex-col items-center cursor-pointer group" onClick={() => onNavigate('profile')}>
                        {/* Line to center */}
                        <div className="absolute top-[32px] right-[32px] w-[200px] h-[1px] bg-gradient-to-r from-primary to-transparent -rotate-[135deg] origin-right opacity-30 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="relative size-16 rounded-full p-0.5 bg-[#101323] ring-2 ring-[#4CE6E6] shadow-[0_0_15px_rgba(76,230,230,0.3)] group-hover:scale-110 transition-transform">
                            <img className="w-full h-full rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA3JJMbtw9q6RUDGK3gOfUGdawhcAfGdXj5DjYsQXGiBouHRaqtz3zsEHtOsUCsdWN2En4pGkHFIelg3n5Vf85y-aRr7ca8yHw24hlLIQcMDtAE0CkU8vMoebKAY02QY9ruDtr3j8LswLzLb5cIc1qN2vYq8YgMT1lkZOUxUJKBYz6of2W1lLDgFX3jhIwbjdY4Y8unwddkhQMFxSgrqEY921CJRB1gkoqYGLefxjaIKX-IImOyxa8J2CQvVUxp96-2nXyosoNBjRkN" alt="Sarah" />
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-black font-bold text-[10px] border border-black">★</div>
                        </div>
                        <span className="mt-2 text-xs font-bold text-[#4CE6E6] bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm border border-[#4CE6E6]/30">Sarah Jenkins</span>
                    </div>

                    {/* Connected Node 2 (David) */}
                    <div className="absolute bottom-[-100px] left-[-120px] z-10 flex flex-col items-center opacity-80 hover:opacity-100 transition-opacity group">
                        {/* Line to center */}
                        <div className="absolute bottom-[24px] left-[24px] w-[140px] h-[1px] bg-gradient-to-l from-purple-400 to-transparent -rotate-[45deg] origin-left opacity-20 group-hover:opacity-60 transition-opacity"></div>

                        <div className="relative size-12 rounded-full p-0.5 bg-[#101323] ring-1 ring-purple-400 group-hover:scale-110 transition-transform">
                            <img className="w-full h-full rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYqn1hZLSu6IRbECO1o44Sk3Mv-Co9x-HRK8eBLG5AwM922-MX1v_7JWY214MipPmoBG0vtIPFwHNOndrDLHtDjfVBvTa0nrYdYN7GNJwREeb2v2wyyWggg2_K29ottiDKsq5pia-cbzfNC-tjQ2b7qZSymvNYqBQ241RB90_OeO4hctcdctuUqmrCMx65bN2QY_kPfPlm_-Hrf9Mvk6tNDGfowcS__NcbPkpUBkqzGZM0VTEBKYRBlvx8-GHuuHQurovcIlG6iZcc" alt="David" />
                        </div>
                        <span className="mt-1 text-[10px] text-gray-300 bg-black/40 px-1.5 py-0.5 rounded-full">David Chen</span>
                    </div>

                    {/* Node 3 (Kenji) */}
                    <div className="absolute top-[80px] right-[180px] z-10 flex flex-col items-center opacity-60 hover:opacity-100 transition-opacity group">
                        <div className="relative size-10 rounded-full p-0.5 bg-[#101323] ring-1 ring-yellow-500 group-hover:scale-110 transition-transform">
                            <img className="w-full h-full rounded-full object-cover grayscale" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBKyg2X_Pn4Qa_rcV_0CxlmA1vF-cgkjzOLnm42qbygn0smiLfck-AVdPT4oe1DHZVLN-Hw12yG2G5tMpxVGSLDN-dFIplb99QbYE7evxFu3eREVARut3VyctT3PA6yU5PmVloA8zxavI5XWdDLD2wCz7u5amyBa1qFiyuhcKZJCnhpWImo7i8UWkeE5U7oXhht9czmPukbp__ef_jP2lrOEKjPINBDqWcBS3jRSNnhJm6AHBRBvlluExrybKKbdzGxfgvHO9obH3x_" alt="Kenji" />
                        </div>
                        <span className="mt-1 text-[9px] text-gray-400">Kenji</span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* --- Floating HUD (Fixed) --- */}
      <div className="absolute top-[80px] left-0 right-0 z-30 p-4 w-full flex flex-col gap-3 pointer-events-none">
        <div className="pointer-events-auto bg-[#1b1d28]/80 backdrop-blur-md border border-white/10 rounded-lg p-3 flex items-center gap-2 shadow-lg w-full max-w-sm mx-auto transition-transform hover:scale-[1.02]">
          <span className="material-symbols-outlined text-gray-400">search</span>
          <input className="bg-transparent border-none text-white text-sm w-full focus:ring-0 outline-none" placeholder="Highlight path to..." />
        </div>
      </div>

      {/* --- Bottom Sheet Detail (Fixed) --- */}
      <div className="absolute bottom-0 left-0 right-0 z-30 w-full bg-[#1b1d28]/95 backdrop-blur-xl border-t border-white/10 rounded-t-xl p-5 pb-8 shadow-2xl transition-transform animate-slide-up">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4"></div>
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-lg bg-cover bg-center border border-white/10 shadow-lg" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA3JJMbtw9q6RUDGK3gOfUGdawhcAfGdXj5DjYsQXGiBouHRaqtz3zsEHtOsUCsdWN2En4pGkHFIelg3n5Vf85y-aRr7ca8yHw24hlLIQcMDtAE0CkU8vMoebKAY02QY9ruDtr3j8LswLzLb5cIc1qN2vYq8YgMT1lkZOUxUJKBYz6of2W1lLDgFX3jhIwbjdY4Y8unwddkhQMFxSgrqEY921CJRB1gkoqYGLefxjaIKX-IImOyxa8J2CQvVUxp96-2nXyosoNBjRkN")' }}></div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-white text-xl font-bold">Sarah Jenkins</h2>
              <span className="bg-primary/20 text-primary border border-primary/20 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">2nd Degree</span>
            </div>
            <p className="text-gray-400 text-sm">VP of Engineering at TechFlow</p>
            <div className="mt-3 flex gap-3">
              <button onClick={() => onNavigate('path')} className="flex-1 bg-primary hover:bg-primary-dark text-black font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm">
                <span className="material-symbols-outlined text-[18px]">handshake</span>
                Warm Intro
              </button>
              <button className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10">
                <span className="material-symbols-outlined">bookmark</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkMap;