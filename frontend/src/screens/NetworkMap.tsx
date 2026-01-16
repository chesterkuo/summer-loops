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
                        return (
                          <line
                            key={i}
                            x1={sourcePos.x}
                            y1={sourcePos.y}
                            x2={targetPos.x}
                            y2={targetPos.y}
                            stroke={edge.source === 'user' ? '#39E079' : '#4CE6E6'}
                            strokeWidth={edge.strength > 7 ? 2 : 1}
                            strokeOpacity={opacity}
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

                      const ringColors = ['#4CE6E6', '#a855f7', '#eab308', '#ef4444'];
                      const ringColor = ringColors[pos.ring % ringColors.length];
                      const nodeSize = pos.ring === 1 ? 'size-14' : pos.ring === 2 ? 'size-12' : 'size-10';
                      const isSelected = selectedNodeId === node.id;

                      return (
                        <div
                          key={node.id}
                          className={`absolute z-10 flex flex-col items-center cursor-pointer group transition-all ${isSelected ? 'z-30' : ''}`}
                          style={{
                            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                          }}
                          onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                        >
                          <div
                            className={`relative ${nodeSize} rounded-full p-0.5 bg-[#101323] ring-2 group-hover:scale-110 transition-transform ${isSelected ? 'scale-125 ring-4' : ''}`}
                            style={{ boxShadow: `0 0 15px ${ringColor}40`, borderColor: ringColor }}
                          >
                            <div
                              className="w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800"
                              style={{ borderColor: ringColor }}
                            >
                              <span className="text-white font-bold text-sm">
                                {node.name?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                            {node.degree >= 3 && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-black font-bold text-[8px] border border-black">
                                {node.degree}
                              </div>
                            )}
                          </div>
                          <span
                            className={`mt-1 text-[10px] font-bold bg-black/50 px-1.5 py-0.5 rounded-full backdrop-blur-sm border truncate max-w-[80px] ${isSelected ? 'text-white' : 'text-gray-300'}`}
                            style={{ borderColor: `${ringColor}40` }}
                          >
                            {node.name?.split(' ')[0] || t('networkMap.unknown')}
                          </span>
                        </div>
                      );
                    })}
                </div>
            </div>
        </div>
      </div>

      {/* --- Floating HUD (Fixed) --- */}
      <div className="absolute top-[80px] left-0 right-0 z-30 p-4 w-full flex flex-col gap-3 pointer-events-none">
        <div className="pointer-events-auto bg-[#1b1d28]/80 backdrop-blur-md border border-white/10 rounded-lg p-3 flex items-center gap-2 shadow-lg w-full max-w-sm mx-auto transition-transform hover:scale-[1.02]">
          <span className="material-symbols-outlined text-gray-400">search</span>
          <input className="bg-transparent border-none text-white text-sm w-full focus:ring-0 outline-none" placeholder={t('networkMap.highlightPath')} />
        </div>
      </div>

      {/* --- Bottom Sheet Detail (Fixed) --- */}
      {(selectedNode || !graphData) && (
        <div className="absolute bottom-0 left-0 right-0 z-30 w-full bg-[#1b1d28]/95 backdrop-blur-xl border-t border-white/10 rounded-t-xl p-5 pb-8 shadow-2xl transition-transform animate-slide-up">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4"></div>
          {selectedNode ? (
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 border border-white/10 shadow-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {selectedNode.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-white text-xl font-bold">{selectedNode.name}</h2>
                  <span className="bg-primary/20 text-primary border border-primary/20 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                    {selectedNode.degree} Connection{selectedNode.degree > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">
                  {selectedNode.title || ''}{selectedNode.title && selectedNode.company ? ' at ' : ''}{selectedNode.company || t('networkMap.noCompanyInfo')}
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => {
                      if (selectedContact) {
                        setSelectedContact(selectedContact);
                        onNavigate('profile');
                      }
                    }}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">person</span>
                    {t('networkMap.viewProfile')}
                  </button>
                  <button onClick={() => onNavigate('path')} className="flex-1 bg-primary hover:bg-primary-dark text-black font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm">
                    <span className="material-symbols-outlined text-[18px]">handshake</span>
                    {t('networkMap.findPath')}
                  </button>
                </div>
              </div>
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