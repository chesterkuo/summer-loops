import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenName } from '../App';
import { useContactStore } from '../stores/contactStore';
import { contactsApi, Contact } from '../services/api';

interface ScanCardProps {
  onNavigate: (screen: ScreenName) => void;
}

const STORAGE_KEY = 'warmly_contact_draft';

const ScanCard: React.FC<ScanCardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { createContact, setSelectedContact, scanCard } = useContactStore();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isScanned, setIsScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch Mode State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(0);
  const [flashActive, setFlashActive] = useState(false);

  // Copy Feedback State
  const [copied, setCopied] = useState(false);

  // Validation State
  const [emailError, setEmailError] = useState<string | null>(null);

  // Voice Input State
  const [isListening, setIsListening] = useState(false);

  // Preview image
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [contactData, setContactData] = useState({
    name: '',
    title: '',
    company: '',
    department: '',
    phone: '',
    email: ''
  });

  // Restore draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) {
          setContactData(parsed);
          setIsScanned(true); // Restore UI state to show the form
        }
      } catch (e) {
        console.error("Failed to restore draft", e);
      }
    }
  }, []);

  // Auto-save draft when data changes
  useEffect(() => {
    if (isScanned) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contactData));
    }
  }, [contactData, isScanned]);

  const validateEmail = (email: string) => {
    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Allow empty email or valid email
    if (email && !emailRegex.test(email)) {
      setEmailError(t('scanCard.invalidEmail'));
      return false;
    }

    setEmailError(null);
    return true;
  };

  const handleScan = () => {
    // Trigger file input to select/capture image
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show flash effect
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    // Convert to base64 and show preview
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      // Remove the data URL prefix for API
      const base64Data = base64.split(',')[1];
      setPreviewImage(base64);

      if (isBatchMode) {
        // In batch mode, just increment count
        setBatchCount(prev => prev + 1);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Scan with AI
      setIsScanning(true);
      setScanError(null);

      const result = await scanCard(base64Data);

      if (result) {
        setContactData({
          name: result.name || '',
          title: result.title || '',
          company: result.company || '',
          department: result.department || '',
          phone: result.phone || '',
          email: result.email || '',
        });
        setIsScanned(true);
      } else {
        setScanError(t('scanCard.scanFailed'));
      }
      setIsScanning(false);

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setIsScanned(false);
    setEmailError(null);
    setScanError(null);
    setPreviewImage(null);
    localStorage.removeItem(STORAGE_KEY); // Clear draft
    // Reset contact data
    setContactData({
      name: '',
      title: '',
      company: '',
      department: '',
      phone: '',
      email: ''
    });
  };

  const handleSave = async () => {
    if (validateEmail(contactData.email)) {
      const newContact = await createContact({
        name: contactData.name,
        title: contactData.title,
        company: contactData.company,
        department: contactData.department,
        phone: contactData.phone,
        email: contactData.email,
        source: 'business_card_scan',
      });

      if (newContact) {
        localStorage.removeItem(STORAGE_KEY); // Clear draft on save
        setSelectedContact(newContact);
        onNavigate('profile');
      }
    }
  };

  const handleAddToContacts = () => {
    // Create vCard content
    const vCard = `BEGIN:VCARD
VERSION:3.0
FN:${contactData.name}
TITLE:${contactData.title}
ORG:${contactData.company}
TEL:${contactData.phone}
EMAIL:${contactData.email}
END:VCARD`;

    // Create a blob and trigger download
    const blob = new Blob([vCard], { type: 'text/vcard' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${contactData.name.replace(/\s+/g, '_')}.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleCopyName = () => {
    if (contactData.name) {
      navigator.clipboard.writeText(contactData.name)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => console.error('Failed to copy: ', err));
    }
  };

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(t('scanCard.speechNotSupported'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      // Simple heuristic: remove spaces for email as people usually don't speak them for email addresses
      const processedEmail = transcript.replace(/\s+/g, '').toLowerCase();
      
      setContactData(prev => ({ ...prev, email: processedEmail }));
      validateEmail(processedEmail);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="bg-background-dark font-display antialiased overflow-hidden h-full flex flex-col text-white relative">
      {/* Confirmation Modal */}
      {showExitConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-fade-in">
           <div className="bg-[#2C3435] rounded-2xl p-6 w-full max-w-xs border border-gray-700 shadow-2xl transform scale-100 transition-all">
            <div className="flex flex-col items-center text-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-1">
                    <span className="material-symbols-outlined">warning</span>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">{t('scanCard.stopScanning')}</h3>
                    <p className="text-gray-400 text-sm mt-1">{t('scanCard.unsavedProgress')}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="py-3 rounded-xl bg-gray-700 text-white font-bold text-sm hover:bg-gray-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => onNavigate('dashboard')}
                className="py-3 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary-dark transition-colors"
              >
                {t('common.exit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for image capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Camera Viewport (Top 65%) */}
      <div className="relative w-full h-[65%] shrink-0 bg-neutral-900 overflow-hidden rounded-b-3xl shadow-2xl z-10">
        {/* Flash Effect Overlay */}
        <div className={`absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-200 ${flashActive ? 'opacity-80' : 'opacity-0'}`}></div>

        {/* Scanning Overlay */}
        {isScanning && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-white font-bold">{t('scanCard.processing')}</p>
            <p className="text-gray-400 text-sm mt-1">{t('scanCard.processingDetails')}</p>
          </div>
        )}

        {/* Preview or placeholder image */}
        <div className="absolute inset-0 w-full h-full">
          <div className="absolute inset-0 bg-black/20 z-10"></div>
          {previewImage ? (
            <img src={previewImage} alt="Scanned card" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
              <div className="text-center">
                <span className="material-symbols-outlined text-[64px] text-gray-600 mb-2">photo_camera</span>
                <p className="text-gray-500 text-sm">{t('scanCard.tapToScan')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Overlays */}
        <div className="absolute top-0 left-0 w-full z-20 flex items-center justify-between p-4 pt-6 bg-gradient-to-b from-black/60 to-transparent">
          <button onClick={() => setShowExitConfirm(true)} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>close</span>
          </button>
          <h2 className="text-white text-lg font-bold tracking-tight drop-shadow-md">
            {isBatchMode && batchCount > 0 ? t('scanCard.batchScan', { count: batchCount }) : t('scanCard.title')}
          </h2>
          <button className="flex size-10 shrink-0 items-center justify-center rounded-full bg-transparent text-white hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>flash_on</span>
          </button>
        </div>

        {/* Frame & Guidance (Only show when not scanned OR in batch mode) */}
        {(!isScanned || isBatchMode) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
            {/* Batch Mode Counter Badge */}
            {isBatchMode && batchCount > 0 && (
              <div className="absolute top-20 bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 shadow-lg animate-fade-in">
                 <span className="material-symbols-outlined text-primary text-sm">filter_none</span>
                 <span className="text-sm font-bold">{t('scanCard.cardsScanned', { count: batchCount })}</span>
              </div>
            )}

            {!isBatchMode && (
              <div className="flex gap-2 mb-4 animate-pulse">
                <div className="flex h-8 items-center justify-center gap-x-1.5 rounded-full bg-white/90 backdrop-blur pl-3 pr-4 shadow-lg border border-primary/20">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>check_circle</span>
                  <p className="text-primary text-xs font-bold uppercase tracking-wide">{t('scanCard.nameFound')}</p>
                </div>
                <div className="flex h-8 items-center justify-center gap-x-1.5 rounded-full bg-primary/90 backdrop-blur pl-3 pr-4 shadow-lg">
                  <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>alternate_email</span>
                  <p className="text-white text-xs font-bold uppercase tracking-wide">{t('scanCard.email')}</p>
                </div>
              </div>
            )}
            
            <div className={`relative w-[85%] aspect-[1.586/1] rounded-xl border-2 shadow-[0_0_0_999px_rgba(0,0,0,0.4)] transition-colors duration-300 ${isBatchMode ? 'border-primary/60' : 'border-white/40'}`}>
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
            </div>
            
            <p className="mt-6 text-white/90 text-sm font-medium drop-shadow-md text-center max-w-[200px]">
              {isBatchMode ? t('scanCard.keepScanning') : t('scanCard.alignCard')}
            </p>
          </div>
        )}
      </div>

      {/* Controls (Bottom 35%) */}
      <div className="flex-1 flex flex-col bg-background-dark relative z-0 -mt-6 pt-10 pb-6 px-6 overflow-y-auto">
        {isScanned && !isBatchMode ? (
          <div className="flex flex-col gap-4 animate-fade-in pb-4">
            <div className="flex items-center justify-between mb-1">
               <h3 className="text-white font-bold text-lg">{t('scanCard.extractedDetails')}</h3>
               <button onClick={handleRetake} className="text-xs text-primary font-bold uppercase tracking-wider hover:underline flex items-center gap-1">
                 <span className="material-symbols-outlined text-sm">replay</span>
                 {t('common.retake')}
               </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider ml-1 mb-1 block">{t('scanCard.name')}</label>
                <div className="relative">
                   <input 
                     type="text"
                     value={contactData.name} 
                     onChange={(e) => setContactData({...contactData, name: e.target.value})}
                     className="w-full bg-[#2C3435] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium"
                   />
                   <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary material-symbols-outlined text-lg">check_circle</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider ml-1 mb-1 block">{t('scanCard.title')}</label>
                    <input
                      type="text"
                      value={contactData.title}
                      onChange={(e) => setContactData({...contactData, title: e.target.value})}
                      className="w-full bg-[#2C3435] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider ml-1 mb-1 block">{t('scanCard.company')}</label>
                    <input
                      type="text"
                      value={contactData.company}
                      onChange={(e) => setContactData({...contactData, company: e.target.value})}
                      className="w-full bg-[#2C3435] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium"
                    />
                 </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider ml-1 mb-1 block">{t('scanCard.department')}</label>
                <input
                   type="text"
                   value={contactData.department}
                   onChange={(e) => setContactData({...contactData, department: e.target.value})}
                   placeholder={t('scanCard.departmentPlaceholder')}
                   className="w-full bg-[#2C3435] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium placeholder:text-gray-600"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider ml-1 mb-1 block">{t('scanCard.phone')}</label>
                <input 
                   type="tel"
                   value={contactData.phone} 
                   onChange={(e) => setContactData({...contactData, phone: e.target.value})}
                   className="w-full bg-[#2C3435] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium"
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase tracking-wider ml-1 mb-1 block ${emailError ? 'text-red-500' : 'text-gray-400'}`}>{t('scanCard.email')}</label>
                <div className="relative">
                  <input 
                     ref={emailInputRef}
                     type="email"
                     value={contactData.email} 
                     onChange={(e) => {
                       setContactData({...contactData, email: e.target.value});
                       if (emailError) validateEmail(e.target.value);
                     }}
                     onBlur={() => validateEmail(contactData.email)}
                     className={`w-full bg-[#2C3435] border ${emailError ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-primary'} rounded-xl pl-4 pr-24 py-3 text-white focus:outline-none transition-colors text-sm font-medium`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button 
                      onClick={() => emailInputRef.current?.focus()}
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Type email"
                    >
                      <span className="material-symbols-outlined text-[20px]">keyboard</span>
                    </button>
                    <button 
                      onClick={handleVoiceInput}
                      className={`transition-all ${isListening ? 'text-red-500 animate-pulse scale-110' : 'text-gray-400 hover:text-white'}`}
                      title="Speak email"
                    >
                      <span className="material-symbols-outlined text-[20px]">{isListening ? 'mic_off' : 'mic'}</span>
                    </button>
                  </div>
                </div>
                {emailError && (
                  <p className="text-red-500 text-[10px] mt-1 font-bold flex items-center gap-1 animate-fade-in">
                    <span className="material-symbols-outlined text-[12px]">error</span>
                    {emailError}
                  </p>
                )}
              </div>
            </div>
            
            <button onClick={handleSave} className="mt-2 w-full bg-primary text-black font-bold py-3.5 rounded-xl hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">person_add</span>
                {t('scanCard.saveContact')}
            </button>

            <button onClick={handleAddToContacts} className="mt-2 w-full bg-[#2C3435] border border-gray-700 text-white font-bold py-3.5 rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">save_alt</span>
                {t('scanCard.addToContacts')}
            </button>

            <button onClick={handleCopyName} className="mt-2 w-full bg-[#2C3435] border border-gray-700 text-white font-bold py-3.5 rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
                <span className={`material-symbols-outlined ${copied ? 'text-primary' : 'text-gray-400'}`}>{copied ? 'check_circle' : 'content_copy'}</span>
                <span className={copied ? 'text-primary' : 'text-gray-300'}>{copied ? t('scanCard.nameCopied') : t('scanCard.copyName')}</span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg">{t('scanCard.options')}</h3>
              <div
                className={`flex items-center gap-3 px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none ${isBatchMode ? 'bg-primary/10 border-primary/20' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                onClick={toggleBatchMode}
              >
                <span className={`text-sm font-medium transition-colors ${isBatchMode ? 'text-primary font-bold' : 'text-gray-400'}`}>{t('scanCard.batchMode')}</span>
                <div className={`w-11 h-6 rounded-full relative transition-colors ${isBatchMode ? 'bg-primary' : 'bg-gray-700'}`}>
                  <div className={`absolute top-[2px] left-[2px] bg-white h-5 w-5 rounded-full transition-transform shadow-sm ${isBatchMode ? 'translate-x-5' : ''}`}></div>
                </div>
              </div>
            </div>

            {/* Gallery Strip */}
            <div className="mb-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('scanCard.recentScans')}</p>
                <button className="text-primary text-xs font-bold hover:underline">{t('scanCard.viewAll')}</button>
              </div>
              <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar -mx-6 px-6">
                <div className="relative shrink-0 w-24 aspect-[3/4] rounded-lg overflow-hidden border border-gray-700 shadow-sm">
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBkIoIcLJN3A7h30hMCkMnzB-WFzOg0EAATEDtj-SeBGgz7rkkaox8Ix7MQIe2Trlni58nBS7cactMQSHf-WQzHkpoNhkJD8CfnUdv4HZDDTxxyJb2CjOZIlbDRL2cPBXtkdS7_QUutsvmWItp4Rnz6LuY6c0RYtdArKgsUTayNuYzeJHj_ATzReByuhzUamXgRHmcemNjfKQm36G_X4HIPKCblowrUYsR8yPk2k63mvHOKVaVZBpHkjCZu_icotBsAoZ1imNcEK9A0")' }}></div>
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                    <span className="material-symbols-outlined text-white text-sm">check_circle</span>
                  </div>
                </div>
                <div className="relative shrink-0 w-24 aspect-[3/4] rounded-lg overflow-hidden border border-gray-700 shadow-sm opacity-70">
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBwWrT_a6sfjIhRkQU9N6FMIUd00i_S6fqEYWtstndo0CJ-VYC_Ti4MJYZ3iYKAUSd1yvgbtxfJmFNGvHOYERwInm9yrKTQ7jXaefa7XgRraMhHHGsUou-TWu7j_WJc1atteDKn44uNyucVaofegV2aM-vJUwRpfRweEft5tQHUeuRVypkBjFs0wS61UQlVzbnANTokMgT57PeuOSveU49UT6AmQDzhGACbxGD8AOPFUXu8ikksVykxek49KGpXaM1a9mIekzVz56qQ")' }}></div>
                </div>
              </div>
            </div>

            {/* Shutter */}
            <div className="flex items-center justify-center mt-6">
              <div className="flex-1 flex justify-start">
                {isBatchMode && batchCount > 0 ? (
                  <button
                    onClick={() => onNavigate('dashboard')} // In reality, go to review
                    className="flex flex-col items-center gap-1 text-primary hover:text-white transition-colors animate-fade-in"
                  >
                     <div className="relative">
                        <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>filter_none</span>
                        <div className="absolute -top-1 -right-1 bg-white text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{batchCount}</div>
                     </div>
                     <span className="text-[10px] font-bold uppercase tracking-wide">{t('common.finish')}</span>
                  </button>
                ) : (
                  <button className="flex flex-col items-center gap-1 text-gray-500 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>photo_library</span>
                  </button>
                )}
              </div>
              
              <div className="relative group cursor-pointer" onClick={handleScan}>
                <div className={`size-20 rounded-full border-4 flex items-center justify-center bg-transparent active:scale-95 transition-all duration-200 ${isBatchMode ? 'border-primary' : 'border-primary'}`}>
                  <div className={`size-16 rounded-full shadow-lg flex items-center justify-center transition-colors ${isBatchMode ? 'bg-primary shadow-primary/30 hover:bg-white hover:text-primary' : 'bg-primary shadow-primary/30 hover:bg-primary-dark'}`}>
                    <span className={`material-symbols-outlined text-3xl ${isBatchMode ? 'text-black' : 'text-white'}`}>
                      {isBatchMode ? 'add_a_photo' : 'photo_camera'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex justify-end gap-5">
                <button 
                  onClick={() => onNavigate('voice')}
                  className="flex flex-col items-center gap-1 text-gray-500 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>mic</span>
                </button>
                <button 
                  onClick={() => onNavigate('draft')}
                  className="flex flex-col items-center gap-1 text-gray-500 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>alternate_email</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-gray-500 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>keyboard</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ScanCard;