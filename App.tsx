import React, { useState } from 'react';
import Dashboard from './screens/Dashboard';
import Profile from './screens/Profile';
import ScanCard from './screens/ScanCard';
import NetworkMap from './screens/NetworkMap';
import VoiceMemo from './screens/VoiceMemo';
import PathDiscovery from './screens/PathDiscovery';
import DraftRequest from './screens/DraftRequest';

// Navigation types
export type ScreenName = 'dashboard' | 'profile' | 'scan' | 'map' | 'voice' | 'path' | 'draft';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('dashboard');

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentScreen} />;
      case 'profile': return <Profile onNavigate={setCurrentScreen} />;
      case 'scan': return <ScanCard onNavigate={setCurrentScreen} />;
      case 'map': return <NetworkMap onNavigate={setCurrentScreen} />;
      case 'voice': return <VoiceMemo onNavigate={setCurrentScreen} />;
      case 'path': return <PathDiscovery onNavigate={setCurrentScreen} />;
      case 'draft': return <DraftRequest onNavigate={setCurrentScreen} />;
      default: return <Dashboard onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <div className="flex justify-center min-h-screen bg-black">
      <div className="w-full max-w-md bg-background-dark h-screen overflow-hidden relative shadow-2xl border-x border-gray-800 flex flex-col">
        {renderScreen()}
        
        {/* Navigation Overlay for Demo purposes - usually hidden or integrated */}
        <div className="absolute top-0 left-0 z-50 p-2 opacity-0 hover:opacity-100 transition-opacity duration-200">
           <select 
             value={currentScreen} 
             onChange={(e) => setCurrentScreen(e.target.value as ScreenName)}
             className="bg-black/80 text-white text-xs p-2 rounded border border-gray-700"
           >
             <option value="dashboard">Dashboard</option>
             <option value="profile">Profile (Sarah)</option>
             <option value="scan">Scan Card</option>
             <option value="map">Network Map</option>
             <option value="voice">Voice Memo</option>
             <option value="path">Path Discovery</option>
             <option value="draft">Draft Request</option>
           </select>
        </div>
      </div>
    </div>
  );
};

export default App;