import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenName } from '../App';
import { useContactStore } from '../stores/contactStore';
import { GraphNode } from '../services/api';

interface NetworkMapProps {
  onNavigate: (screen: ScreenName) => void;
}

// Position nodes in a circular layout around center
function calculateNodePositions(nodes: GraphNode[], centerX: number, centerY: number) {
  const positions: { [id: string]: { x: number; y: number; ring: number } } = {};
  const userNode = nodes.find(n => n.id === 'user');

  if (userNode) {
    positions[userNode.id] = { x: centerX, y: centerY, ring: 0 };
  }

  // Sort by degree (more connected = closer to center)
  const otherNodes = nodes.filter(n => n.id !== 'user').sort((a, b) => b.degree - a.degree);

  // Place in concentric rings
  const rings = [
    { radius: 120, max: 6 },
    { radius: 200, max: 12 },
    { radius: 280, max: 18 },
  ];

  let nodeIndex = 0;
  rings.forEach((ring, ringIndex) => {
    const nodesForRing = otherNodes.slice(nodeIndex, nodeIndex + ring.max);
    nodesForRing.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.min(nodesForRing.length, ring.max) - Math.PI / 2;
      positions[node.id] = {
        x: centerX + ring.radius * Math.cos(angle),
        y: centerY + ring.radius * Math.sin(angle),
        ring: ringIndex + 1,
      };
    });
    nodeIndex += ring.max;
  });

  return positions;
}

const NetworkMap: React.FC<NetworkMapProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { graphData, fetchGraph, contacts, fetchContacts, setSelectedContact, isLoading } = useContactStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  // Fetch graph data on mount
  useEffect(() => {
    fetchGraph();
    fetchContacts();
  }, []);

  // Calculate node positions
  const nodePositions = useMemo(() => {
    if (!graphData?.nodes) return {};
    return calculateNodePositions(graphData.nodes, 0, 0);
  }, [graphData]);

  // Get selected node info
  const selectedNode = graphData?.nodes.find(n => n.id === selectedNodeId);
  const selectedContact = contacts.find(c => c.id === selectedNodeId);

  // Filter nodes based on search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !graphData?.nodes) return [];
    const query = searchQuery.toLowerCase();
    return graphData.nodes.filter(n =>
      n.id !== 'user' && (
        n.name?.toLowerCase().includes(query) ||
        n.company?.toLowerCase().includes(query) ||
        n.title?.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, graphData]);

  // Handle search input change - only filter, don't zoom
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Clear selection when search changes, but don't auto-zoom
    if (!value.trim()) {
      setHighlightedNodeId(null);
    }
  };

  // Handle selecting a search result
  const handleSelectSearchResult = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setHighlightedNodeId(nodeId);
    setSearchQuery('');

    // Pan to the node
    const pos = nodePositions[nodeId];
    if (pos) {
      setTransform(prev => ({
        ...prev,
        x: -pos.x * prev.scale,
        y: -pos.y * prev.scale
      }));
    }
  };

  // --- Gesture Handlers ---

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag if not touching a button, node, or interactive element
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-node]')) return;

    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    target.setPointerCapture(e.pointerId);
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
      <header className="absolute top-0 left-0 right-0 z-40 px-4 pt-4 pb-2 pointer-events-none safe-area-top safe-area-inset-x">
        <div className="flex justify-between items-center">
          <button onClick={() => onNavigate('dashboard')} className="pointer-events-auto flex items-center justify-center size-10 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-white/10 transition-colors border border-white/10">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="pointer-events-auto flex flex-col items-center">
            <h1 className="text-white text-base font-bold tracking-wide uppercase opacity-80">{t('networkMap.title')}</h1>
            <p className="text-primary text-xs font-medium">
              {isLoading ? t('common.loading') : t('networkMap.connectionsCount', { count: (graphData?.nodes?.length || 1) - 1 })}
            </p>
          </div>
          <button
            onClick={() => setShowFilters(true)}
            className="pointer-events-auto flex items-center justify-center size-10 rounded-full bg-primary text-black hover:bg-primary-dark transition-all shadow-[0_0_15px_rgba(57,224,121,0.4)] active:scale-90"
          >
            <span className="material-symbols-outlined text-[20px] font-bold">tune</span>
          </button>
        </div>
        {/* Search bar - flows below header row */}
        <div className="pointer-events-auto w-full max-w-sm mx-auto relative mt-2">
          <div className="bg-[#1b1d28]/90 backdrop-blur-md border border-white/10 rounded-xl p-2.5 sm:p-3 flex items-center gap-2 shadow-lg">
            <span className="material-symbols-outlined text-gray-400 text-[20px]">search</span>
            <input
              className="bg-transparent border-none text-white text-sm w-full focus:ring-0 outline-none placeholder:text-gray-500"
              placeholder={t('networkMap.highlightPath')}
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setHighlightedNodeId(null); }}
                className="text-gray-400 hover:text-white p-1"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchQuery && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1b1d28]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-xl max-h-[50vh] overflow-y-auto overscroll-contain">
              {searchResults.map(node => (
                <button
                  key={node.id}
                  onClick={() => handleSelectSearchResult(node.id)}
                  className={`w-full px-3 sm:px-4 py-3 flex items-center gap-3 hover:bg-white/10 active:bg-white/15 transition-colors text-left border-b border-white/5 last:border-0 ${
                    highlightedNodeId === node.id ? 'bg-primary/20' : ''
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">
                      {node.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{node.name}</p>
                    <p className="text-gray-400 text-xs truncate">
                      {node.title}{node.title && node.company ? ' at ' : ''}{node.company || t('networkMap.noCompanyInfo')}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-gray-500 text-[18px]">arrow_forward</span>
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {searchQuery && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1b1d28]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-xl p-4 text-center">
              <p className="text-gray-400 text-sm">{t('search.noResults')}</p>
            </div>
          )}
        </div>
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
                    {t('networkMap.filters')}
                 </h2>
                 <button onClick={() => setShowFilters(false)} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white">
                    <span className="material-symbols-outlined">close</span>
                 </button>
              </div>

              <div className="space-y-6">
                 {/* Degrees */}
                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">{t('networkMap.connectionDegree')}</label>
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
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">{t('networkMap.industries')}</label>
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
                    <span className="text-sm font-medium text-white">{t('networkMap.showDormant')}</span>
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
                    {t('networkMap.applyFilters')}
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
                    {/* Render Edges (Lines) */}
                    <svg className="absolute inset-0 overflow-visible pointer-events-none" style={{ width: 1, height: 1 }}>
                      {graphData?.edges.map((edge, i) => {
                        const sourcePos = nodePositions[edge.source];
                        const targetPos = nodePositions[edge.target];
                        if (!sourcePos || !targetPos) return null;
                        const opacity = 0.1 + (edge.strength / 10) * 0.4;
                        // Use blue color for team edges
                        const isTeamEdge = (edge as any).isTeamEdge;
                        const strokeColor = isTeamEdge
                          ? '#3B82F6'  // Blue for team edges
                          : edge.source === 'user'
                            ? '#39E079'  // Green for user edges
                            : '#4CE6E6'; // Cyan for other edges
                        return (
                          <line
                            key={i}
                            x1={sourcePos.x}
                            y1={sourcePos.y}
                            x2={targetPos.x}
                            y2={targetPos.y}
                            stroke={strokeColor}
                            strokeWidth={edge.strength > 7 ? 2 : 1}
                            strokeOpacity={isTeamEdge ? opacity + 0.2 : opacity}
                            strokeDasharray={isTeamEdge ? '5,3' : undefined}
                          />
                        );
                      })}
                    </svg>

                    {/* Central Node (Me) */}
                    <div className="absolute z-20 flex flex-col items-center" style={{ transform: 'translate(-50%, -50%)' }}>
                        <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping scale-150"></div>
                        <div className="relative size-20 rounded-full p-1 bg-[#101323] ring-2 ring-primary shadow-[0_0_30px_rgba(57,224,121,0.3)] flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary">{t('networkMap.me')}</span>
                        </div>
                        <span className="mt-2 text-xs font-bold bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/10">{t('networkMap.you')}</span>
                    </div>

                    {/* Render Contact Nodes */}
                    {graphData?.nodes.filter(n => n.id !== 'user').map((node) => {
                      const pos = nodePositions[node.id];
                      if (!pos) return null;

                      // Check if this is a team contact or teammate
                      const isTeammate = (node as any).isTeammate;
                      const isTeamContact = (node as any).isTeamContact;
                      const teamName = (node as any).teamName;

                      // Use blue colors for team nodes
                      const ringColors = ['#4CE6E6', '#a855f7', '#eab308', '#ef4444'];
                      const ringColor = isTeammate || isTeamContact
                        ? '#3B82F6'  // Blue for team nodes
                        : ringColors[pos.ring % ringColors.length];
                      const nodeSize = pos.ring === 1 ? 'size-14' : pos.ring === 2 ? 'size-12' : 'size-10';
                      const isSelected = selectedNodeId === node.id;
                      const isHighlighted = highlightedNodeId === node.id;
                      const isSearchMatch = searchQuery && searchResults.some(r => r.id === node.id);

                      return (
                        <div
                          key={node.id}
                          data-node={node.id}
                          className={`absolute z-10 flex flex-col items-center cursor-pointer group transition-all ${isSelected || isHighlighted ? 'z-30' : ''} ${searchQuery && !isSearchMatch ? 'opacity-30' : ''}`}
                          style={{
                            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Always select the node when clicked (don't toggle off)
                            setSelectedNodeId(node.id);
                            setHighlightedNodeId(node.id);
                          }}
                        >
                          <div
                            className={`relative ${nodeSize} rounded-full p-0.5 bg-[#101323] ring-2 group-hover:scale-110 transition-transform ${isSelected || isHighlighted ? 'scale-125 ring-4' : ''}`}
                            style={{
                              boxShadow: isHighlighted ? `0 0 25px ${ringColor}` : `0 0 15px ${ringColor}40`,
                              borderColor: ringColor
                            }}
                          >
                            <div
                              className={`w-full h-full rounded-full flex items-center justify-center ${isTeammate ? 'bg-gradient-to-br from-blue-600 to-blue-800' : isTeamContact ? 'bg-gradient-to-br from-blue-500/30 to-blue-700/30' : 'bg-gradient-to-br from-gray-700 to-gray-800'}`}
                              style={{ borderColor: ringColor }}
                            >
                              {isTeammate ? (
                                <span className="material-symbols-outlined text-white text-sm">groups</span>
                              ) : (
                                <span className="text-white font-bold text-sm">
                                  {node.name?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                              )}
                            </div>
                            {node.degree >= 3 && !isTeammate && !isTeamContact && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-black font-bold text-[8px] border border-black">
                                {node.degree}
                              </div>
                            )}
                            {isTeamContact && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border border-black">
                                <span className="material-symbols-outlined text-white text-[10px]">share</span>
                              </div>
                            )}
                          </div>
                          <span
                            className={`mt-1 text-[10px] font-bold bg-black/50 px-1.5 py-0.5 rounded-full backdrop-blur-sm border truncate max-w-[80px] ${isSelected ? 'text-white' : isTeammate || isTeamContact ? 'text-blue-300' : 'text-gray-300'}`}
                            style={{ borderColor: `${ringColor}40` }}
                          >
                            {node.name?.split(' ')[0] || t('networkMap.unknown')}
                          </span>
                          {(isTeammate || isTeamContact) && teamName && (
                            <span className="text-[8px] text-blue-400 bg-blue-500/20 px-1 py-0.5 rounded mt-0.5 truncate max-w-[80px]">
                              {teamName}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
            </div>
        </div>
      </div>

      {/* --- Zoom Controls (Fixed) --- */}
      <div className="absolute bottom-32 left-4 z-40 flex flex-col gap-2 pointer-events-auto safe-area-inset-left">
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(4, prev.scale + 0.3) }))}
          className="w-10 h-10 bg-[#1b1d28]/90 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all shadow-lg"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
        </button>
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.3) }))}
          className="w-10 h-10 bg-[#1b1d28]/90 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all shadow-lg"
        >
          <span className="material-symbols-outlined text-[20px]">remove</span>
        </button>
      </div>


      {/* --- Bottom Sheet Detail (Fixed) --- */}
      {(selectedNode || !graphData) && (
        <div className="absolute bottom-0 left-0 right-0 z-30 w-full bg-[#1b1d28]/95 backdrop-blur-xl border-t border-white/10 rounded-t-xl p-5 pb-8 shadow-2xl transition-transform animate-slide-up safe-area-inset-bottom">
          {/* Drag handle / close button */}
          <div className="flex items-center justify-center mb-4 relative">
            <div
              className="w-10 h-1 bg-white/20 rounded-full cursor-pointer"
              onClick={() => {
                setSelectedNodeId(null);
                setHighlightedNodeId(null);
              }}
            ></div>
            {selectedNode && (
              <button
                onClick={() => {
                  setSelectedNodeId(null);
                  setHighlightedNodeId(null);
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/10 text-gray-400"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          {selectedNode ? (
            <div className="flex gap-4">
              {(() => {
                const isTeammate = (selectedNode as any).isTeammate;
                const isTeamContact = (selectedNode as any).isTeamContact;
                const teamName = (selectedNode as any).teamName;
                const sharedBy = (selectedNode as any).sharedBy;
                return (
                  <>
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg ${isTeammate || isTeamContact ? 'bg-gradient-to-br from-blue-500/30 to-blue-700/30' : 'bg-gradient-to-br from-primary/30 to-accent/30'} border border-white/10 shadow-lg flex items-center justify-center flex-shrink-0`}>
                      {isTeammate ? (
                        <span className="material-symbols-outlined text-blue-400 text-2xl">groups</span>
                      ) : (
                        <span className="text-xl sm:text-2xl font-bold text-white">
                          {selectedNode.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h2 className="text-white text-lg sm:text-xl font-bold truncate">{selectedNode.name}</h2>
                        {isTeammate ? (
                          <span className="bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                            {t('pathDiscovery.teammate')}
                          </span>
                        ) : isTeamContact ? (
                          <span className="bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                            {t('pathDiscovery.teamContact')}
                          </span>
                        ) : (
                          <span className="bg-primary/20 text-primary border border-primary/20 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                            {selectedNode.degree} {selectedNode.degree > 1 ? 'Connections' : 'Connection'}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm truncate">
                        {isTeammate ? (
                          <>{teamName && <span className="text-blue-400">{teamName}</span>}</>
                        ) : isTeamContact ? (
                          <>{sharedBy && <span>{t('pathDiscovery.via')} {sharedBy}</span>}{teamName && <span className="text-blue-400 ml-1">• {teamName}</span>}</>
                        ) : (
                          <>{selectedNode.title || ''}{selectedNode.title && selectedNode.company ? ' at ' : ''}{selectedNode.company || t('networkMap.noCompanyInfo')}</>
                        )}
                      </p>
                      <div className="mt-3 flex gap-2 sm:gap-3">
                  <button
                    onClick={() => {
                      // Use selectedContact if available, otherwise create minimal contact from node
                      if (selectedContact) {
                        setSelectedContact(selectedContact);
                      } else {
                        // Create a minimal contact object from node data for navigation
                        setSelectedContact({
                          id: selectedNode.id,
                          user_id: '',
                          name: selectedNode.name || '',
                          company: selectedNode.company || null,
                          department: null,
                          title: selectedNode.title || null,
                          email: null,
                          phone: null,
                          linkedin_url: null,
                          notes: null,
                          ai_summary: null,
                          source: null,
                          created_at: '',
                          updated_at: '',
                          line_id: null,
                          telegram_username: null,
                          whatsapp_number: null,
                          wechat_id: null,
                          twitter_handle: null,
                          facebook_url: null,
                          instagram_handle: null,
                        });
                      }
                      onNavigate('profile');
                    }}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 px-3 sm:px-4 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 transition-colors text-xs sm:text-sm active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">person</span>
                    <span className="truncate">{t('networkMap.viewProfile')}</span>
                  </button>
                  <button
                    onClick={() => {
                      // Use selectedContact if available, otherwise create minimal contact from node
                      if (selectedContact) {
                        setSelectedContact(selectedContact);
                      } else {
                        setSelectedContact({
                          id: selectedNode.id,
                          user_id: '',
                          name: selectedNode.name || '',
                          company: selectedNode.company || null,
                          department: null,
                          title: selectedNode.title || null,
                          email: null,
                          phone: null,
                          linkedin_url: null,
                          notes: null,
                          ai_summary: null,
                          source: null,
                          created_at: '',
                          updated_at: '',
                          line_id: null,
                          telegram_username: null,
                          whatsapp_number: null,
                          wechat_id: null,
                          twitter_handle: null,
                          facebook_url: null,
                          instagram_handle: null,
                        });
                      }
                      onNavigate('path');
                    }}
                    className="flex-1 bg-primary hover:bg-primary-dark text-black font-bold py-2.5 px-3 sm:px-4 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 transition-colors text-xs sm:text-sm active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">handshake</span>
                    <span className="truncate">{t('networkMap.findPath')}</span>
                  </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400">{isLoading ? t('networkMap.loadingNetwork') : t('networkMap.tapToExplore')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NetworkMap;