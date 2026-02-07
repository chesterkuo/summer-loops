import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenName } from '../App';
import { useContactStore } from '../stores/contactStore';
import BottomNav from '../components/BottomNav';

interface VoiceMemoProps {
  onNavigate: (screen: ScreenName) => void;
}

interface ParsedMeetingData {
  contact?: {
    name?: string;
    company?: string;
    title?: string;
    notes?: string;
  };
  meetingNotes?: string;
}

const VoiceMemo: React.FC<VoiceMemoProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { parseText, createContact, fetchContacts, setSelectedContact, isLoading } = useContactStore();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Parsing state
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedMeetingData | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit mode for parsed data
  const [editedContact, setEditedContact] = useState({
    name: '',
    company: '',
    title: '',
    notes: ''
  });

  // Refs
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const transcriptRef = useRef('');
  const interimRef = useRef('');
  const lastInterimTimeRef = useRef<number>(0);
  const interimFinalizeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check browser support and platform
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isSupported = !!SpeechRecognition;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Sync refs with state for use in event handlers
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Initialize speech recognition ONCE
  useEffect(() => {
    if (!isSupported) return;

    const recognition = new SpeechRecognition();
    // iOS Safari doesn't handle continuous mode well
    // Use continuous on desktop, but be more careful on iOS
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-TW'; // Support Traditional Chinese, will also recognize English

    // For iOS, also try English as a fallback
    if (isIOS) {
      console.log('iOS detected - using adapted speech recognition settings');
      // iOS works better with shorter recognition sessions
      recognition.maxAlternatives = 1;
    }

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript(prev => prev + final + ' ');
        transcriptRef.current = transcriptRef.current + final + ' ';
        // Clear any pending finalize timer since we got a final result
        if (interimFinalizeTimerRef.current) {
          clearTimeout(interimFinalizeTimerRef.current);
          interimFinalizeTimerRef.current = null;
        }
      }

      // Track interim in ref for capture on stop
      interimRef.current = interim;
      setInterimTranscript(interim);

      // Auto-finalize interim after 1.5 seconds of no new results
      // This helps on platforms where isFinal never becomes true
      if (interim && !final) {
        lastInterimTimeRef.current = Date.now();
        if (interimFinalizeTimerRef.current) {
          clearTimeout(interimFinalizeTimerRef.current);
        }
        interimFinalizeTimerRef.current = setTimeout(() => {
          // If we still have the same interim text after 1.5s, finalize it
          if (interimRef.current && isRecordingRef.current && !isPausedRef.current) {
            const textToFinalize = interimRef.current;
            interimRef.current = '';
            setTranscript(prev => prev + textToFinalize + ' ');
            transcriptRef.current = transcriptRef.current + textToFinalize + ' ';
            setInterimTranscript('');
          }
        }, 1500);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError(t('voiceMemo.micPermissionDenied'));
        setIsRecording(false);
      } else if (event.error === 'no-speech') {
        // Ignore no-speech errors, just restart if still recording
        // Use refs to get current values (avoid stale closures)
        if (isRecordingRef.current && !isPausedRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Already started
          }
        }
      } else if (event.error === 'aborted') {
        // Aborted is normal when stopping, don't show error
        console.log('Speech recognition aborted');
      } else {
        setError(t('voiceMemo.recognitionError'));
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      // If we have remaining interim text and we're NOT actively recording,
      // capture it as final (this handles the case where isFinal never fired)
      if (!isRecordingRef.current && interimRef.current.trim()) {
        const remaining = interimRef.current;
        interimRef.current = '';
        setTranscript(prev => {
          if (!prev.includes(remaining)) { // Avoid duplicates
            const newTranscript = prev + remaining + ' ';
            transcriptRef.current = newTranscript;
            return newTranscript;
          }
          return prev;
        });
        setInterimTranscript('');
      }

      // Auto-restart if still recording and not paused
      if (isRecordingRef.current && !isPausedRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Failed to restart
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Already stopped
        }
      }
      if (interimFinalizeTimerRef.current) {
        clearTimeout(interimFinalizeTimerRef.current);
      }
    };
  }, [isSupported, isIOS, t]); // Removed isRecording and isPaused - use refs instead

  // Timer for recording duration
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start recording
  const startRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    setError(null);
    setTranscript('');
    setInterimTranscript('');
    setRecordingTime(0);
    setParsedData(null);
    setSaveSuccess(false);

    // Reset refs
    transcriptRef.current = '';
    interimRef.current = '';
    isRecordingRef.current = true;
    isPausedRef.current = false;
    lastInterimTimeRef.current = 0;
    if (interimFinalizeTimerRef.current) {
      clearTimeout(interimFinalizeTimerRef.current);
      interimFinalizeTimerRef.current = null;
    }

    try {
      recognitionRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setError(t('voiceMemo.startError'));
      isRecordingRef.current = false;
    }
  }, [t]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    // Clear any pending finalize timer
    if (interimFinalizeTimerRef.current) {
      clearTimeout(interimFinalizeTimerRef.current);
      interimFinalizeTimerRef.current = null;
    }

    // Update refs BEFORE stopping so onend handler doesn't restart
    isRecordingRef.current = false;
    isPausedRef.current = false;

    // Capture any remaining interim transcript as final BEFORE stopping
    // This is crucial for platforms where isFinal doesn't work properly (iOS)
    const currentInterim = interimRef.current.trim();
    if (currentInterim) {
      setTranscript(prev => {
        const newTranscript = prev + currentInterim + ' ';
        transcriptRef.current = newTranscript;
        return newTranscript;
      });
    }

    // Clear interim
    interimRef.current = '';
    setInterimTranscript('');

    try {
      recognitionRef.current.stop();
    } catch (e) {
      // Already stopped
    }

    setIsRecording(false);
    setIsPaused(false);
  }, []);

  // Pause/Resume recording
  const togglePause = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isPausedRef.current) {
      // Resume
      isPausedRef.current = false;
      try {
        recognitionRef.current.start();
        setIsPaused(false);
      } catch (e) {
        console.error('Failed to resume:', e);
        isPausedRef.current = true;
      }
    } else {
      // Pause
      isPausedRef.current = true;
      recognitionRef.current.stop();
      setIsPaused(true);
    }
  }, []);

  // Parse transcript with AI
  const parseTranscript = async () => {
    if (!transcript.trim()) return;

    setIsParsing(true);
    setError(null);

    try {
      const result = await parseText(transcript);

      if (result && result.name) {
        setParsedData({
          contact: {
            name: result.name,
            company: result.company || '',
            title: result.title || '',
            notes: result.notes || ''
          },
          meetingNotes: transcript
        });
        setEditedContact({
          name: result.name || '',
          company: result.company || '',
          title: result.title || '',
          notes: result.notes || ''
        });
        setShowSaveModal(true);
      } else {
        // No contact found, just save as notes
        setParsedData({
          meetingNotes: transcript
        });
        setShowSaveModal(true);
      }
    } catch (e) {
      console.error('Parse failed:', e);
      setError(t('voiceMemo.parseFailed'));
    } finally {
      setIsParsing(false);
    }
  };

  // Save contact
  const saveContact = async () => {
    if (!editedContact.name.trim()) {
      setError(t('voiceMemo.nameRequired'));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await createContact({
        name: editedContact.name,
        company: editedContact.company || undefined,
        title: editedContact.title || undefined,
        notes: editedContact.notes || transcript,
        source: 'natural_language'
      });

      if (result) {
        await fetchContacts();
        setSaveSuccess(true);
        setShowSaveModal(false);

        // Navigate to contact profile
        setTimeout(() => {
          setSelectedContact(result.contact);
          onNavigate('profile');
        }, 1000);
      }
    } catch (e) {
      console.error('Save failed:', e);
      setError(t('voiceMemo.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // Clear and start over
  const handleClear = () => {
    // Stop recording if active
    if (isRecordingRef.current && recognitionRef.current) {
      isRecordingRef.current = false;
      isPausedRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }

    // Clear any pending timers
    if (interimFinalizeTimerRef.current) {
      clearTimeout(interimFinalizeTimerRef.current);
      interimFinalizeTimerRef.current = null;
    }

    // Clear refs
    transcriptRef.current = '';
    interimRef.current = '';

    // Clear state
    setIsRecording(false);
    setIsPaused(false);
    setTranscript('');
    setInterimTranscript('');
    setRecordingTime(0);
    setParsedData(null);
    setSaveSuccess(false);
    setError(null);
    setShowSaveModal(false);
  };

  // Generate waveform bars
  const waveformBars = Array.from({ length: 24 }, (_, i) => {
    const baseHeight = isRecording && !isPaused
      ? 20 + Math.sin((Date.now() / 100 + i * 0.5)) * 40 + Math.random() * 20
      : 20;
    return Math.max(10, Math.min(100, baseHeight));
  });

  if (!isSupported) {
    return (
      <div className="flex flex-col h-full bg-background-dark font-display text-white">
        <header className="flex items-center justify-between p-6">
          <button onClick={() => onNavigate('dashboard')} className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold">{t('voiceMemo.title')}</h1>
          <div className="w-10" />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <span className="material-symbols-outlined text-6xl text-red-400 mb-4">mic_off</span>
          <h2 className="text-xl font-bold mb-2">{t('voiceMemo.notSupported')}</h2>
          <p className="text-gray-400 text-sm">{t('voiceMemo.notSupportedDesc')}</p>
        </div>
        <BottomNav active="voice" onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background-dark font-display text-white overflow-hidden relative">
      {/* Save Modal */}
      {showSaveModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-sm rounded-2xl p-5 border border-white/10 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person_add</span>
                {parsedData?.contact?.name ? t('voiceMemo.saveContact') : t('voiceMemo.meetingNotes')}
              </h3>
              <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {parsedData?.contact?.name ? (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 mb-3">{t('voiceMemo.editBeforeSave')}</p>

                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">{t('scanCard.name')}</label>
                  <input
                    value={editedContact.name}
                    onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                    className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">{t('scanCard.company')}</label>
                    <input
                      value={editedContact.company}
                      onChange={(e) => setEditedContact({ ...editedContact, company: e.target.value })}
                      className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">{t('scanCard.jobTitle')}</label>
                    <input
                      value={editedContact.title}
                      onChange={(e) => setEditedContact({ ...editedContact, title: e.target.value })}
                      className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">{t('voiceMemo.meetingNotes')}</label>
                  <textarea
                    value={editedContact.notes || transcript}
                    onChange={(e) => setEditedContact({ ...editedContact, notes: e.target.value })}
                    className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors h-24 resize-none"
                  />
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={saveContact}
                    disabled={isSaving || !editedContact.name.trim()}
                    className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-black text-sm font-bold transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                        {t('common.loading')}
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        {t('common.save')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-gray-400 text-sm mb-4">{t('voiceMemo.noContactFound')}</p>
                <div className="bg-black/20 rounded-xl p-4 border border-gray-700">
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{transcript}</p>
                </div>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="w-full mt-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors"
                >
                  {t('common.close')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <button onClick={() => onNavigate('dashboard')} className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2d1b1b] border border-red-900/30 rounded-full shadow-sm">
          <span className="material-symbols-outlined text-[16px] text-red-500">lock</span>
          <span className="text-xs font-medium text-red-400 tracking-wide">{t('voiceMemo.processedLocally')}</span>
        </div>
        <button onClick={handleClear} className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined">delete</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        {/* Timer */}
        <div className={`text-7xl font-bold tracking-tighter tabular-nums mb-6 transition-colors ${isRecording ? 'text-white' : 'text-gray-500'}`}>
          {formatTime(recordingTime)}
        </div>

        {/* Status Indicator */}
        <div className={`flex items-center gap-2 font-medium mb-8 h-6 ${isRecording && !isPaused ? 'text-primary animate-pulse' : isPaused ? 'text-yellow-500' : 'text-gray-500'}`}>
          {isRecording && !isPaused && (
            <>
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              {t('voiceMemo.recording')}
            </>
          )}
          {isPaused && (
            <>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              {t('common.pause')}
            </>
          )}
          {!isRecording && !isPaused && recordingTime === 0 && (
            <span className="text-gray-400">{t('voiceMemo.tapToStart')}</span>
          )}
          {!isRecording && recordingTime > 0 && (
            <span className="text-primary">{t('voiceMemo.readyToProcess')}</span>
          )}
        </div>

        {/* Waveform */}
        <div className="h-24 w-full flex items-center justify-center gap-1 mb-8">
          {waveformBars.map((height, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-full transition-all duration-150 ${isRecording && !isPaused ? 'bg-primary' : 'bg-gray-600'}`}
              style={{ height: `${height}%`, opacity: isRecording && !isPaused ? 0.4 + (height / 200) : 0.3 }}
            />
          ))}
        </div>

        {/* Live Transcript Card */}
        <div className="w-full relative group">
          <div className={`absolute -top-3 left-6 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider z-10 border ${
            isRecording ? 'bg-primary text-black border-black' : 'bg-gray-700 text-gray-300 border-gray-600'
          }`}>
            {t('voiceMemo.liveTranscript')}
          </div>
          <div className="w-full bg-[#1c252b] rounded-xl border border-gray-800 p-6 pt-8 relative overflow-hidden min-h-[120px] max-h-[200px] overflow-y-auto no-scrollbar">
            {transcript || interimTranscript ? (
              <p className="text-lg leading-relaxed text-gray-300 font-light whitespace-pre-wrap">
                {transcript}
                {interimTranscript && (
                  <span className="text-primary/60">{interimTranscript}</span>
                )}
              </p>
            ) : (
              <p className="text-gray-500 text-center">{t('voiceMemo.transcriptPlaceholder')}</p>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#1c252b] to-transparent pointer-events-none"></div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {saveSuccess && (
          <div className="mt-4 px-4 py-2 bg-primary/20 border border-primary/30 rounded-lg animate-fade-in">
            <p className="text-primary text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {t('voiceMemo.saveSuccess')}
            </p>
          </div>
        )}
      </main>

      {/* Controls */}
      <footer className="absolute bottom-20 left-0 right-0 p-6 flex items-center justify-between max-w-sm mx-auto w-full">
        {/* Cancel / Clear Button */}
        <button
          onClick={() => isRecording ? stopRecording() : onNavigate('dashboard')}
          className="flex flex-col items-center gap-2 group"
        >
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-gray-700 transition-colors">
            <span className="material-symbols-outlined text-[28px] text-gray-400">
              {isRecording ? 'stop' : 'close'}
            </span>
          </div>
          <span className="text-xs font-medium text-gray-500">
            {isRecording ? t('voiceMemo.stop') : t('common.cancel')}
          </span>
        </button>

        {/* Main Action Button */}
        {!isRecording && transcript ? (
          // Process with AI button
          <button
            onClick={parseTranscript}
            disabled={isParsing || isLoading}
            className="flex flex-col items-center gap-2 group"
          >
            <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(57,224,121,0.4)] transition-all ${
              isParsing ? 'bg-gray-700' : 'bg-primary group-hover:scale-105'
            }`}>
              {isParsing ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              ) : (
                <span className="material-symbols-outlined text-[40px] text-black">auto_awesome</span>
              )}
            </div>
            <span className="text-xs font-bold text-primary">
              {isParsing ? t('quickNote.processing') : t('voiceMemo.processWithAI')}
            </span>
          </button>
        ) : (
          // Record button
          <button
            onClick={isRecording ? togglePause : startRecording}
            className="flex flex-col items-center gap-2 group"
          >
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isRecording && !isPaused
                ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                : 'bg-primary shadow-[0_0_30px_rgba(57,224,121,0.4)] group-hover:scale-105'
            }`}>
              <span className="material-symbols-outlined text-[40px] text-black">
                {isRecording && !isPaused ? 'pause' : isPaused ? 'play_arrow' : 'mic'}
              </span>
            </div>
            <span className={`text-xs font-bold ${isRecording && !isPaused ? 'text-red-400' : 'text-primary'}`}>
              {isRecording && !isPaused ? t('common.pause') : isPaused ? t('voiceMemo.resume') : t('voiceMemo.startRecording')}
            </span>
          </button>
        )}

        {/* Pause/Resume or Done Button */}
        <button
          onClick={() => {
            if (isRecording) {
              stopRecording();
            } else if (transcript) {
              parseTranscript();
            }
          }}
          disabled={!isRecording && !transcript}
          className="flex flex-col items-center gap-2 group"
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            isRecording || transcript
              ? 'bg-gray-800 group-hover:bg-gray-700'
              : 'bg-gray-800/50'
          }`}>
            <span className={`material-symbols-outlined text-[28px] ${
              isRecording || transcript ? 'text-white' : 'text-gray-600'
            }`}>
              {isRecording ? 'check' : 'send'}
            </span>
          </div>
          <span className={`text-xs font-medium ${isRecording || transcript ? 'text-gray-500' : 'text-gray-600'}`}>
            {isRecording ? t('common.done') : t('voiceMemo.process')}
          </span>
        </button>
      </footer>

      <BottomNav active="voice" onNavigate={onNavigate} />
    </div>
  );
};

export default VoiceMemo;
