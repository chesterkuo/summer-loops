import React from 'react';
import { ScreenName } from '../App';

interface BottomNavProps {
  active: 'home' | 'network' | 'insights' | 'profile' | 'voice';
  onNavigate: (screen: ScreenName) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ active, onNavigate }) => {
  return (
    <div className="fixed bottom-0 w-full max-w-md bg-surface-card/95 backdrop-blur-md border-t border-gray-800 pb-safe pt-2 z-40">
      <div className="flex justify-around items-center h-14">
        <button 
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center gap-1 ${active === 'home' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <span className={`material-symbols-outlined text-[24px] ${active === 'home' ? 'icon-filled' : ''}`}>home</span>
          <span className="text-[10px] font-medium">Home</span>
        </button>
        
        <button 
          onClick={() => onNavigate('map')}
          className={`flex flex-col items-center gap-1 ${active === 'network' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <span className={`material-symbols-outlined text-[24px] ${active === 'network' ? 'icon-filled' : ''}`}>hub</span>
          <span className="text-[10px] font-medium">Network</span>
        </button>

        <button 
          onClick={() => onNavigate('voice')}
          className={`flex flex-col items-center gap-1 group`}
        >
           <div className={`p-2 rounded-full transition-all ${active === 'voice' ? 'bg-primary text-black shadow-[0_0_15px_rgba(57,224,121,0.4)]' : 'bg-gray-700 text-gray-300 group-hover:bg-gray-600 group-hover:text-white'}`}>
             <span className={`material-symbols-outlined text-[24px] ${active === 'voice' ? 'icon-filled' : ''}`}>mic</span>
           </div>
        </button>

        <button 
          onClick={() => onNavigate('path')}
          className={`flex flex-col items-center gap-1 ${active === 'insights' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <span className={`material-symbols-outlined text-[24px] ${active === 'insights' ? 'icon-filled' : ''}`}>insights</span>
          <span className="text-[10px] font-medium">Insights</span>
        </button>

        <button 
          onClick={() => onNavigate('profile')}
          className={`flex flex-col items-center gap-1 ${active === 'profile' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <span className={`material-symbols-outlined text-[24px] ${active === 'profile' ? 'icon-filled' : ''}`}>person</span>
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
    </div>
  );
};

export default BottomNav;