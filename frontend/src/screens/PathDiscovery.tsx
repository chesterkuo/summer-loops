import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import BottomNav from '../components/BottomNav';
import { ScreenName } from '../App';
import { pathsApi, PathResult, Contact } from '../services/api';
import { useContactStore } from '../stores/contactStore';

interface PathDiscoveryProps {
  onNavigate: (screen: ScreenName) => void;
}

const PathDiscovery: React.FC<PathDiscoveryProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { contacts, fetchContacts, setSelectedContact, selectedContact, setIntroPath } = useContactStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [paths, setPaths] = useState<PathResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [initializedFromContact, setInitializedFromContact] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  // If navigated from Network page with a selected contact, pre-populate search
  useEffect(() => {
    if (selectedContact && !initializedFromContact) {
      setSearchQuery(selectedContact.name);
      setInitializedFromContact(true);
      // Auto-trigger search after setting the query
      setTimeout(() => {
        handleSearchWithQuery(selectedContact.name);
      }, 100);
    }
  }, [selectedContact, initializedFromContact]);

  const handleSearchWithQuery = async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    const result = await pathsApi.search({
      targetDescription: query,
      maxHops: 4,
    });

    if (result.data?.paths) {
      setPaths(result.data.paths);
    } else {
      setPaths([]);
    }
    setIsSearching(false);
  };

  const handleSearch = async () => {
    await handleSearchWithQuery(searchQuery);
  };

  // Get the best path (first one)
  const bestPath = paths[0];
  const alternativePaths = paths.slice(1);

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
        <h2 className="text-white text-lg font-bold">{t('pathDiscovery.title')}</h2>
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
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('pathDiscovery.searchPlaceholder')}
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="p-2 rounded-full bg-primary text-black hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined">arrow_forward</span>
                )}
              </button>
            </div>
          </div>

          {/* Show initial state or results */}
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="material-symbols-outlined text-[64px] text-gray-600 mb-4">explore</span>
              <h3 className="text-lg font-bold text-white mb-2">{t('pathDiscovery.findYourPath')}</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                {t('pathDiscovery.searchDescription')}
              </p>
            </div>
          ) : isSearching ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-gray-400">{t('pathDiscovery.searchingNetwork')}</p>
            </div>
          ) : !bestPath ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="material-symbols-outlined text-[64px] text-gray-600 mb-4">sentiment_dissatisfied</span>
              <h3 className="text-lg font-bold text-white mb-2">{t('pathDiscovery.noPathFound')}</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                {t('pathDiscovery.noPathDescription')}
              </p>
            </div>
          ) : bestPath.hops === 1 ? (
            /* Direct Connection - Already Connected */
            <>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              {/* Success Icon */}
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-primary/30">
                  <span className="material-symbols-outlined text-[48px] text-primary icon-filled">check_circle</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                  {t('pathDiscovery.directConnection')}
                </div>
              </div>

              {/* Target Contact */}
              {(() => {
                const target = bestPath.path[bestPath.path.length - 1];
                const targetContact = contacts.find(c => c.id === target.contactId);
                return (
                  <div className="mb-6">
                    <div
                      className="w-20 h-20 rounded-full bg-surface-card p-1 border-2 border-primary mx-auto mb-3 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800 cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => {
                        if (targetContact) {
                          setSelectedContact(targetContact);
                          onNavigate('profile');
                        }
                      }}
                    >
                      <span className="font-bold text-white text-2xl">
                        {target.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">{target.name}</h3>
                    <p className="text-gray-400 text-sm">{target.title || target.company || ''}</p>
                  </div>
                );
              })()}

              {/* Already Connected Badge */}
              <div className="bg-primary/10 border border-primary/30 rounded-2xl px-6 py-4 max-w-sm">
                <div className="flex items-center gap-2 justify-center mb-2">
                  <span className="material-symbols-outlined text-primary">handshake</span>
                  <span className="text-primary font-bold">{t('pathDiscovery.alreadyConnected')}</span>
                </div>
                <p className="text-gray-300 text-sm">
                  {t('pathDiscovery.directConnectionDesc', { name: bestPath.path[bestPath.path.length - 1]?.name?.split(' ')[0] || 'This contact' })}
                </p>
              </div>
            </div>

            {/* Action Buttons for Direct Connection */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const target = bestPath.path[bestPath.path.length - 1];
                  const targetContact = contacts.find(c => c.id === target.contactId);
                  if (targetContact) {
                    setSelectedContact(targetContact);
                    onNavigate('profile');
                  }
                }}
                className="flex-1 bg-surface-card hover:bg-surface-card/80 text-white font-bold py-4 rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined">person</span>
                {t('networkMap.viewProfile')}
              </button>
              <button
                onClick={() => onNavigate('draft')}
                className="flex-1 bg-primary hover:bg-primary-dark text-black font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(57,224,121,0.3)] flex items-center justify-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined icon-filled">mail</span>
                {t('pathDiscovery.messageDirectly')}
              </button>
            </div>
            </>
          ) : (
          <>
          <div className="flex items-center justify-between px-1 mt-2">
            <div>
              <span className="text-xs font-bold tracking-wider text-primary uppercase block mb-1 animate-pulse">{t('pathDiscovery.bestRouteFound')}</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">{t('pathDiscovery.introPath')}</h2>
            </div>
            <div className="flex gap-1.5 bg-surface-card p-1 rounded-full border border-white/10">
              {paths.map((_, i) => (
                <span key={i} className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-primary shadow-[0_0_8px_rgba(57,224,121,0.6)]' : 'bg-gray-600'}`}></span>
              ))}
            </div>
          </div>

          {/* Path Visualizer */}
          <div className="w-full overflow-x-auto no-scrollbar py-4 -mx-6 px-6">
            <div className="flex items-center min-w-full justify-between gap-2">
              {/* Render each node in the path */}
              {bestPath.path.map((node, index) => {
                const isFirst = index === 0;
                const isLast = index === bestPath.path.length - 1;
                const isConnector = !isFirst && !isLast;
                const edge = bestPath.edges[index];
                const contact = contacts.find(c => c.id === node.contactId);
                const isTeamNode = !!(node as any).teamSource;
                const teamSource = (node as any).teamSource;
                const isTeammate = node.contactId?.startsWith('teammate:');
                const isTeamContact = node.contactId?.startsWith('team:');

                return (
                  <React.Fragment key={node.contactId}>
                    {/* Node */}
                    <div
                      className={`flex flex-col items-center gap-3 shrink-0 relative group ${isConnector ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (contact && !isFirst) {
                          setSelectedContact(contact);
                          onNavigate('profile');
                        }
                      }}
                    >
                      {isConnector && (
                        <div className={`absolute -inset-4 ${isTeammate ? 'bg-blue-500/10' : 'bg-primary/10'} rounded-2xl blur-xl group-hover:${isTeammate ? 'bg-blue-500/20' : 'bg-primary/20'} transition-colors`}></div>
                      )}
                      <div className="relative z-10">
                        <div className={`${isConnector ? 'w-24 h-24 rounded-2xl' : 'w-20 h-20 rounded-full'} bg-surface-card p-1 ${isFirst ? 'border-2 border-dashed border-primary/30' : isConnector ? (isTeammate ? 'shadow-[0_0_20px_rgba(59,130,246,0.2)] border border-blue-500 ring-2 ring-blue-500/20' : 'shadow-[0_0_20px_rgba(57,224,121,0.2)] border border-primary ring-2 ring-primary/20') : isTeamContact ? 'border-2 border-blue-400/60' : 'border-2 border-gray-600 opacity-60'} ${isConnector ? 'group-hover:scale-105' : ''} transition-transform duration-300 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800`}>
                          <span className={`font-bold text-white ${isConnector ? 'text-2xl' : 'text-xl'}`}>
                            {node.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        {isFirst && (
                          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-surface-card px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-gray-700 text-gray-300 shadow-sm">YOU</div>
                        )}
                        {isTeammate && (
                          <div className="absolute -top-3 -right-3 bg-blue-500 text-white p-1.5 rounded-full border-4 border-background-dark shadow-lg">
                            <span className="material-symbols-outlined text-[16px] font-bold block">groups</span>
                          </div>
                        )}
                        {!isTeammate && isConnector && (
                          <div className="absolute -top-3 -right-3 bg-primary text-black p-1.5 rounded-full border-4 border-background-dark shadow-lg">
                            <span className="material-symbols-outlined text-[16px] font-bold block">star</span>
                          </div>
                        )}
                        {isTeamContact && !isConnector && (
                          <div className="absolute -top-2 -right-2 bg-blue-500 text-white p-1 rounded-full border-2 border-background-dark shadow-lg">
                            <span className="material-symbols-outlined text-[12px] block">share</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center z-10">
                        <p className={`font-bold text-white ${isConnector ? 'text-base group-hover:text-primary' : 'text-sm'} transition-colors`}>
                          {node.name?.split(' ')[0] || t('networkMap.unknown')}
                        </p>
                        {isTeammate ? (
                          <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wide bg-blue-500/10 px-2 py-0.5 rounded-full inline-block mt-0.5">{t('pathDiscovery.teammate')}</p>
                        ) : isConnector ? (
                          <p className="text-primary text-[10px] font-bold uppercase tracking-wide bg-primary/10 px-2 py-0.5 rounded-full inline-block mt-0.5">{t('pathDiscovery.connector')}</p>
                        ) : isTeamContact ? (
                          <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wide bg-blue-500/10 px-2 py-0.5 rounded-full inline-block mt-0.5">{t('pathDiscovery.teamContact')}</p>
                        ) : (
                          <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wide">{node.title || node.company || ''}</p>
                        )}
                        {teamSource && !isTeammate && (
                          <p className="text-blue-300 text-[9px] mt-0.5">{t('pathDiscovery.via')} {teamSource.teamName}</p>
                        )}
                      </div>
                    </div>

                    {/* Connector line */}
                    {!isLast && (
                      <div className={`flex-1 min-w-[40px] h-[2px] ${edge?.strength >= 4 ? 'bg-gradient-to-r from-primary/30 via-primary to-primary/30' : 'bg-gray-700'} relative mx-1 self-center mb-8`}>
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center animate-fade-in-up">
                          <div className={`${bestPath.estimatedSuccessRate >= 60 ? 'bg-green-500/10 text-green-400 border-green-500/30' : bestPath.estimatedSuccessRate >= 40 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'} text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm mb-1 border`}>
                            {Math.round(bestPath.estimatedSuccessRate)}% Match
                          </div>
                          <span className="material-symbols-outlined text-primary text-[14px]">arrow_forward</span>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
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
                  <h3 className="text-base font-bold text-white leading-tight mb-1">{t('pathDiscovery.pathStrength')}</h3>
                  <p className={`text-xs font-medium flex items-center gap-1 ${bestPath.estimatedSuccessRate >= 60 ? 'text-green-400' : bestPath.estimatedSuccessRate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                    <span className="material-symbols-outlined text-[14px]">trending_up</span>
                    {bestPath.estimatedSuccessRate >= 60 ? t('pathDiscovery.highResponse') : bestPath.estimatedSuccessRate >= 40 ? t('pathDiscovery.mediumResponse') : t('pathDiscovery.lowResponse')}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed font-light">
                This path has <span className="font-bold text-white">{bestPath.hops} hop{bestPath.hops > 1 ? 's' : ''}</span> and an overall strength of <span className="font-bold text-white">{Math.round(bestPath.pathStrength * 10)}%</span>.
                {bestPath.path.length > 2 && (
                  <> The connector <span className="font-bold text-white border-b border-white/20">{bestPath.path[1]?.name}</span> can help bridge the introduction.</>
                )}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-dark border border-gray-700 text-xs font-medium text-gray-300">
                  <span className="material-symbols-outlined text-[16px] text-accent">route</span> {bestPath.hops} Hop{bestPath.hops > 1 ? 's' : ''}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-dark border border-gray-700 text-xs font-medium text-gray-300">
                  <span className="material-symbols-outlined text-[16px] text-blue-400">speed</span> {Math.round(bestPath.estimatedSuccessRate)}% Success
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-dark border border-gray-700 text-xs font-medium text-gray-300">
                  <span className="material-symbols-outlined text-[16px] text-pink-400">fitness_center</span> {Math.round(bestPath.pathStrength * 10)}/100 Strength
                </span>
              </div>
            </div>
          </div>

          {/* Alternative Paths */}
          {alternativePaths.length > 0 && (
            <div className="mt-2">
              <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-500 text-[18px]">alt_route</span>
                {t('pathDiscovery.alternativePaths')} ({alternativePaths.length})
              </h3>
              <div className="flex flex-col gap-3">
                {alternativePaths.map((altPath, i) => {
                  const connectors = altPath.path.slice(1, -1);
                  const strengthLevel = altPath.pathStrength >= 6 ? t('pathDiscovery.strong') : altPath.pathStrength >= 4 ? t('pathDiscovery.medium') : t('pathDiscovery.weak');
                  const strengthColor = altPath.pathStrength >= 6 ? 'bg-green-500/20 text-green-500' : altPath.pathStrength >= 4 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500';

                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-card border border-transparent hover:border-gray-700 transition-colors cursor-pointer">
                      <div className="flex -space-x-2 overflow-hidden">
                        {connectors.slice(0, 2).map((node, j) => (
                          <div key={j} className="inline-flex size-8 rounded-full ring-2 ring-background-dark items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                            <span className="text-xs font-bold text-white">{node.name?.charAt(0) || '?'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            Via {connectors.map(n => n.name?.split(' ')[0]).join(' + ')}
                          </span>
                          <span className={`text-[10px] ${strengthColor} px-1.5 rounded font-bold`}>{strengthLevel}</span>
                        </div>
                        <p className="text-xs text-gray-500">{altPath.hops} hops, {Math.round(altPath.estimatedSuccessRate)}% success rate</p>
                      </div>
                      <span className="material-symbols-outlined text-gray-600">chevron_right</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>
          )}
        </main>
      </div>

      {/* Action Bar */}
      {bestPath && bestPath.hops > 1 && (
        <div className="p-6 bg-[#181d20] border-t border-gray-800 z-10 shrink-0 mb-20">
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('pathDiscovery.successProbability')}</span>
            <span className={`text-sm font-bold ${bestPath.estimatedSuccessRate >= 60 ? 'text-primary' : bestPath.estimatedSuccessRate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
              {bestPath.estimatedSuccessRate >= 60 ? t('pathDiscovery.high') : bestPath.estimatedSuccessRate >= 40 ? t('pathDiscovery.medium') : t('pathDiscovery.low')} ({Math.round(bestPath.estimatedSuccessRate)}%)
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 mb-5 overflow-hidden">
            <div
              className={`h-full rounded-full ${bestPath.estimatedSuccessRate >= 60 ? 'bg-primary' : bestPath.estimatedSuccessRate >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${bestPath.estimatedSuccessRate}%` }}
            ></div>
          </div>
          <button
            onClick={() => {
              // Set the intro path from the discovered path
              if (bestPath?.path) {
                setIntroPath(bestPath.path.map(p => ({
                  contactId: p.contactId,
                  name: p.name,
                  company: p.company
                })));
              }
              onNavigate('draft');
            }}
            className="w-full bg-primary hover:bg-primary-dark text-black font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(57,224,121,0.3)] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined icon-filled">edit_note</span>
            {t('pathDiscovery.draftIntroRequest')}
          </button>
        </div>
      )}

      {/* Bottom Nav */}
      <BottomNav active="insights" onNavigate={onNavigate} />
    </div>
  );
};

export default PathDiscovery;