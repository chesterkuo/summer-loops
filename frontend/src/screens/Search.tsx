import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import BottomNav from '../components/BottomNav';
import { ScreenName } from '../App';
import { useContactStore } from '../stores/contactStore';
import { searchApi, Contact } from '../services/api';

interface SearchProps {
  onNavigate: (screen: ScreenName) => void;
}

interface SearchResult {
  contact: Contact;
  score: number;
  matchedFields: string[];
}

interface SimilarContact extends Contact {
  similarityScore: number;
  similarityReasons: string[];
}

const Search: React.FC<SearchProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { setSelectedContact } = useContactStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedForSimilar, setSelectedForSimilar] = useState<Contact | null>(null);
  const [similarContacts, setSimilarContacts] = useState<SimilarContact[]>([]);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Save search to recent
  const saveRecentSearch = (query: string) => {
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Perform search
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSelectedForSimilar(null);
    setSimilarContacts([]);

    const result = await searchApi.search(query, 20);

    if (result.data) {
      setSearchResults(result.data);
      saveRecentSearch(query);
    } else {
      setSearchResults([]);
    }

    setIsSearching(false);
  }, [recentSearches]);

  // Handle search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      performSearch(searchQuery);
    }
  };

  // Find similar contacts
  const findSimilarContacts = async (contact: Contact) => {
    setSelectedForSimilar(contact);
    setIsLoadingSimilar(true);

    const result = await searchApi.findSimilar(contact.id, 10);

    if (result.data) {
      setSimilarContacts(result.data);
    } else {
      setSimilarContacts([]);
    }

    setIsLoadingSimilar(false);
  };

  // Navigate to contact profile
  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    onNavigate('profile');
  };

  // Get avatar URL
  const getAvatarUrl = (contact: Contact, index: number) => {
    const colors = ['39E079', 'FCD96B', '3B82F6', 'EF4444', '8B5CF6'];
    const color = colors[index % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=${color}&color=fff&size=128`;
  };

  // Get match field color
  const getMatchFieldColor = (field: string) => {
    switch (field) {
      case 'name': return 'bg-green-500/20 text-green-400';
      case 'company': return 'bg-blue-500/20 text-blue-400';
      case 'title': return 'bg-purple-500/20 text-purple-400';
      case 'notes': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-dark font-display text-white overflow-hidden">
      {/* Header */}
      <header className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => onNavigate('dashboard')}
            className="size-10 flex items-center justify-center rounded-full bg-surface-card hover:bg-gray-700 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold text-white">{t('search.title')}</h1>
        </div>

        {/* Search Input */}
        <div className="relative flex items-center h-14 w-full rounded-2xl bg-surface-card shadow-lg transition-all focus-within:ring-2 focus-within:ring-primary/20">
          <div className="absolute left-4 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined icon-filled">search</span>
          </div>
          <input
            className="h-full w-full rounded-2xl border-none bg-transparent pl-12 pr-12 text-base font-medium text-white placeholder:text-text-muted/60 focus:ring-0 outline-none"
            placeholder={t('search.placeholder')}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              className="absolute right-4 flex items-center justify-center text-text-muted hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        {/* Search Button */}
        <button
          onClick={() => performSearch(searchQuery)}
          disabled={!searchQuery.trim() || isSearching}
          className="mt-3 w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-black text-sm font-bold transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {isSearching ? t('search.searching') : t('search.searchButton')}
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-24">
        {/* Similar Contacts Panel */}
        {selectedForSimilar && (
          <div className="mb-6 bg-surface-card rounded-2xl p-4 border border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">group</span>
                <span className="text-sm font-bold text-white">{t('search.similarTo', { name: selectedForSimilar.name })}</span>
              </div>
              <button
                onClick={() => { setSelectedForSimilar(null); setSimilarContacts([]); }}
                className="text-text-muted hover:text-white"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {isLoadingSimilar ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : similarContacts.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-4">{t('search.noSimilar')}</p>
            ) : (
              <div className="space-y-3">
                {similarContacts.map((contact, index) => (
                  <div
                    key={contact.id}
                    onClick={() => handleContactClick(contact)}
                    className="flex items-center gap-3 p-3 bg-background-dark rounded-xl cursor-pointer hover:bg-gray-800 transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-lg bg-gray-700 bg-center bg-cover flex-shrink-0"
                      style={{ backgroundImage: `url("${getAvatarUrl(contact, index)}")` }}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{contact.name}</h4>
                      <p className="text-xs text-text-muted truncate">
                        {contact.title || ''} {contact.company ? `@ ${contact.company}` : ''}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {contact.similarityReasons.map((reason, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary rounded-full">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{contact.similarityScore}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent Searches */}
        {!isSearching && searchResults.length === 0 && !selectedForSimilar && recentSearches.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-bold text-text-muted mb-3">{t('search.recentSearches')}</h3>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((query, index) => (
                <button
                  key={index}
                  onClick={() => { setSearchQuery(query); performSearch(query); }}
                  className="flex items-center gap-1 px-3 py-2 bg-surface-card rounded-full text-sm text-white hover:bg-gray-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-text-muted">history</span>
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-4"></div>
            <p className="text-text-muted">{t('search.searching')}</p>
          </div>
        ) : searchResults.length > 0 ? (
          <div>
            <h3 className="text-sm font-bold text-text-muted mb-3">
              {t('search.resultsCount', { count: searchResults.length })}
            </h3>
            <div className="space-y-3">
              {searchResults.map((result, index) => (
                <div
                  key={result.contact.id}
                  className="bg-surface-card rounded-2xl p-4 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      onClick={() => handleContactClick(result.contact)}
                      className="w-12 h-12 rounded-xl bg-gray-700 bg-center bg-cover flex-shrink-0 cursor-pointer"
                      style={{ backgroundImage: `url("${getAvatarUrl(result.contact, index)}")` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div
                          onClick={() => handleContactClick(result.contact)}
                          className="cursor-pointer"
                        >
                          <h4 className="font-bold text-white text-base hover:text-primary transition-colors">{result.contact.name}</h4>
                          <p className="text-xs text-text-muted">
                            {result.contact.title || ''} {result.contact.company ? `@ ${result.contact.company}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full">
                          <span className="material-symbols-outlined text-[14px] text-primary">star</span>
                          <span className="text-xs font-bold text-primary">{result.score}</span>
                        </div>
                      </div>

                      {/* Matched Fields */}
                      {result.matchedFields.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {result.matchedFields.map((field, i) => (
                            <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getMatchFieldColor(field)}`}>
                              {t(`search.fields.${field}`)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleContactClick(result.contact)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-black rounded-lg text-xs font-bold hover:bg-primary-dark transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">person</span>
                          {t('search.viewProfile')}
                        </button>
                        <button
                          onClick={() => findSimilarContacts(result.contact)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-surface-card border border-gray-700 text-white rounded-lg text-xs font-bold hover:bg-gray-700 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">group</span>
                          {t('search.findSimilar')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : searchQuery && !isSearching ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="material-symbols-outlined text-4xl text-text-muted mb-3">search_off</span>
            <p className="text-text-muted text-center">{t('search.noResults')}</p>
            <p className="text-text-muted/60 text-sm text-center mt-1">{t('search.tryDifferent')}</p>
          </div>
        ) : !selectedForSimilar && recentSearches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="material-symbols-outlined text-4xl text-text-muted mb-3">search</span>
            <p className="text-text-muted text-center">{t('search.startSearching')}</p>
            <p className="text-text-muted/60 text-sm text-center mt-1">{t('search.aiPowered')}</p>
          </div>
        ) : null}
      </div>

      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  );
};

export default Search;
