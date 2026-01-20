import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './screens/Dashboard';
import Profile from './screens/Profile';
import ScanCard from './screens/ScanCard';
import NetworkMap from './screens/NetworkMap';
import VoiceMemo from './screens/VoiceMemo';
import PathDiscovery from './screens/PathDiscovery';
import DraftRequest from './screens/DraftRequest';
import CompanyDetail from './screens/CompanyDetail';
import Search from './screens/Search';
import Teams from './screens/Teams';
import Login from './screens/Login';
import TermsOfService from './screens/TermsOfService';
import PrivacyPolicy from './screens/PrivacyPolicy';
import Support from './screens/Support';
import { useAuthStore } from './stores/authStore';

// Navigation types
export type ScreenName = 'dashboard' | 'profile' | 'scan' | 'map' | 'voice' | 'path' | 'draft' | 'company' | 'search' | 'teams';

// Main app component (authenticated)
const MainApp: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('dashboard');
  const { isAuthenticated, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

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
      case 'search': return <Search onNavigate={setCurrentScreen} />;
      case 'teams': return <Teams onNavigate={setCurrentScreen} />;
      default: return <Dashboard onNavigate={setCurrentScreen} />;
    }
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex justify-center min-h-screen bg-black md:bg-background-dark">
        <div className="w-full max-w-md md:max-w-full bg-background-dark h-screen flex items-center justify-center shadow-2xl border-x border-gray-800 md:border-0">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-text-muted">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex justify-center min-h-screen bg-black md:bg-background-dark">
        <div className="w-full max-w-md md:max-w-full bg-background-dark h-screen overflow-hidden relative shadow-2xl border-x border-gray-800 md:border-0 flex flex-col">
          <Login onAuthenticated={() => setCurrentScreen('dashboard')} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center min-h-screen bg-black md:bg-background-dark">
      <div className="w-full max-w-md md:max-w-full bg-background-dark h-screen overflow-hidden relative shadow-2xl border-x border-gray-800 md:border-0 flex flex-col">
        {renderScreen()}
      </div>
    </div>
  );
};

// App with routes
const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/tos" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/support" element={<Support />} />
      <Route path="/*" element={<MainApp />} />
    </Routes>
  );
};

export default App;
