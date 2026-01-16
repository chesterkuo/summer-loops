import React, { useState } from 'react';
import Dashboard from './screens/Dashboard';
import Profile from './screens/Profile';
import ScanCard from './screens/ScanCard';
import NetworkMap from './screens/NetworkMap';
import VoiceMemo from './screens/VoiceMemo';
import PathDiscovery from './screens/PathDiscovery';
import DraftRequest from './screens/DraftRequest';
import CompanyDetail from './screens/CompanyDetail';

// Navigation types
export type ScreenName = 'dashboard' | 'profile' | 'scan' | 'map' | 'voice' | 'path' | 'draft' | 'company';

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
      case 'company': return <CompanyDetail onNavigate={setCurrentScreen} />;
      default: return <Dashboard onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <div className="flex justify-center min-h-screen bg-black">
      <div className="w-full max-w-md bg-background-dark h-screen overflow-hidden relative shadow-2xl border-x border-gray-800 flex flex-col">
        {renderScreen()}
      </div>
    </div>
  );
};

export default App;