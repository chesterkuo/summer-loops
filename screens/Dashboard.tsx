import React, { useState } from 'react';
import BottomNav from '../components/BottomNav';
import { ScreenName } from '../App';

interface DashboardProps {
  onNavigate: (screen: ScreenName) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showAllOpportunities, setShowAllOpportunities] = useState(false);
  const [noteText, setNoteText] = useState('');

  const handleSaveNote = () => {
    // Here we would save the note to a store
    setShowNoteModal(false);
    setNoteText('');
  };

  return (
    <div className="flex flex-col h-full bg-background-dark font-display text-white overflow-hidden relative">
      {/* All Opportunities Modal */}
      {showAllOpportunities && (
        <div className="absolute inset-0 z-50 bg-background-dark flex flex-col animate-fade-in">
           <header className="flex items-center justify-between p-6 border-b border-white/5 bg-background-dark/95 backdrop-blur-sm sticky top-0 z-10">
              <h2 className="text-xl font-bold text-white">All Opportunities</h2>
              <button 
                onClick={() => setShowAllOpportunities(false)}
                className="size-10 flex items-center justify-center rounded-full bg-surface-card hover:bg-gray-700 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
           </header>
           <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-24">
              {/* Card 1: Sarah Chen */}
              <div 
                onClick={() => { setShowAllOpportunities(false); onNavigate('path'); }}
                className="group relative flex flex-col gap-4 rounded-2xl bg-surface-card p-5 transition-all hover:bg-gray-800 cursor-pointer border border-transparent hover:border-primary/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl bg-gray-700 bg-center bg-cover" 
                      style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBpDk3iGSfNytBgrSaLZ5PYOmvLP4ftPsd2JVcQvOw4Lcy3IujqD8Q9n16COvVIDptEyRSxXk4sef9BpH22iudIzG92--HPFqo-DWFXSChqn4w4mqff4JyYKGAkQKSTbbqDROFC9Ai0_P7eZzYctuEtUUeDcJ-AAwMM8x_1I2kyKINHbyvqWO2tIHrSCqNrtVTE1jHf2ZsL41pev2APyaJCGoVIgmxALdJKIotpx_RD6FfFeSJvB46kq86KddSrBst4jaBFsLE_fw7G")' }}
                    ></div>
                    <div>
                      <h4 className="font-bold text-white text-base">Sarah Chen</h4>
                      <p className="text-xs text-text-muted font-medium">VP Engineering @ TechCorp</p>
                      <div className="mt-1 inline-flex items-center rounded-md bg-green-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">
                        Strongest Path
                      </div>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>

              {/* Card 2: David Miller */}
              <div className="group relative flex flex-col gap-4 rounded-2xl bg-surface-card p-5 transition-all hover:bg-gray-800 cursor-pointer border border-transparent hover:border-primary/20">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl bg-gray-700 bg-center bg-cover" 
                      style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDfvKukurdN39N5zKyre4x9vdl5o0oriTTLjV_zA8iXUBTYnSyZibrG4870uYpwJBWxuRbzuNvmNEzwM289knGwW1JkEwYVpQm05xeunE7DqX_e40x7FP3nBDxkZG181f6_YH84G5VjWEqTmCjRB7-pE4AlnMTfskFN3D48NAH4XcJiHPbsLJtMxH0Ou4zjzuYHG-mBm1_bLGPWIigyUrbhAq2hwa4HAZ7p3z7IYHR5H7fP_bHkSaOURJYNzpQQPr8DQp08g5mPh4wH")' }}
                    ></div>
                    <div>
                      <h4 className="font-bold text-white text-base">David Miller</h4>
                      <p className="text-xs text-text-muted font-medium">Founder @ GreenLoop</p>
                      <div className="mt-1 inline-flex items-center rounded-md bg-yellow-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-500">
                        2nd Degree
                      </div>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>

              {/* Card 3: Kenji Tanaka */}
              <div 
                onClick={() => { setShowAllOpportunities(false); onNavigate('draft'); }}
                className="group relative flex flex-col gap-4 rounded-2xl bg-surface-card p-5 transition-all hover:bg-gray-800 cursor-pointer border border-transparent hover:border-primary/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl bg-gray-700 bg-center bg-cover grayscale" 
                      style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBKyg2X_Pn4Qa_rcV_0CxlmA1vF-cgkjzOLnm42qbygn0smiLfck-AVdPT4oe1DHZVLN-Hw12yG2G5tMpxVGSLDN-dFIplb99QbYE7evxFu3eREVARut3VyctT3PA6yU5PmVloA8zxavI5XWdDLD2wCz7u5amyBa1qFiyuhcKZJCnhpWImo7i8UWkeE5U7oXhht9czmPukbp__ef_jP2lrOEKjPINBDqWcBS3jRSNnhJm6AHBRBvlluExrybKKbdzGxfgvHO9obH3x_")' }}
                    ></div>
                    <div>
                      <h4 className="font-bold text-white text-base">Kenji Tanaka</h4>
                      <p className="text-xs text-text-muted font-medium">Director @ FintechAsia</p>
                      <div className="mt-1 inline-flex items-center rounded-md bg-yellow-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-500">
                        2nd Degree
                      </div>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
                {/* Context for Kenji */}
                <div className="pl-14">
                  <p className="text-xs text-gray-400 italic">"Connected via Sarah. Good time to reach out about the Asian market expansion."</p>
                </div>
              </div>

               {/* Card 4: Lisa Wong */}
               <div className="group relative flex flex-col gap-4 rounded-2xl bg-surface-card p-5 transition-all hover:bg-gray-800 cursor-pointer border border-transparent hover:border-primary/20">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl bg-gray-700 bg-center bg-cover" 
                      style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBwWrT_a6sfjIhRkQU9N6FMIUd00i_S6fqEYWtstndo0CJ-VYC_Ti4MJYZ3iYKAUSd1yvgbtxfJmFNGvHOYERwInm9yrKTQ7jXaefa7XgRraMhHHGsUou-TWu7j_WJc1atteDKn44uNyucVaofegV2aM-vJUwRpfRweEft5tQHUeuRVypkBjFs0wS61UQlVzbnANTokMgT57PeuOSveU49UT6AmQDzhGACbxGD8AOPFUXu8ikksVykxek49KGpXaM1a9mIekzVz56qQ")' }}
                    ></div>
                    <div>
                      <h4 className="font-bold text-white text-base">Lisa Wong</h4>
                      <p className="text-xs text-text-muted font-medium">Product Lead @ DesignCo</p>
                      <div className="mt-1 inline-flex items-center rounded-md bg-blue-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                        Reconnect
                      </div>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>

           </div>
        </div>
      )}

      {/* Quick Note Modal */}
      {showNoteModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-[#2C3435] w-full max-w-sm rounded-2xl p-5 border border-white/10 shadow-2xl">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Quick Note</h3>
                <button onClick={() => setShowNoteModal(false)} className="text-gray-400 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
             </div>
             <textarea 
               value={noteText}
               onChange={(e) => setNoteText(e.target.value)}
               placeholder="Capture a thought, idea, or reminder..."
               className="w-full bg-black/20 border border-gray-700 rounded-xl p-4 text-white text-sm focus:border-primary outline-none h-32 resize-none mb-4 placeholder:text-gray-500 transition-colors"
               autoFocus
             />
             <div className="flex gap-3">
               <button 
                  onClick={() => setShowNoteModal(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors"
               >
                 Cancel
               </button>
               <button 
                  onClick={handleSaveNote}
                  className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-black text-sm font-bold transition-colors shadow-lg shadow-primary/20"
               >
                 Save
               </button>
             </div>
           </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-6 pb-2">
        <div className="flex items-center gap-3">
          <div className="relative cursor-pointer" onClick={() => onNavigate('profile')}>
            <div 
              className="bg-center bg-no-repeat bg-cover rounded-full w-10 h-10 ring-2 ring-surface-card shadow-sm" 
              style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDK8ukbe3JY8du_VVFhK-Bm5fF_lcil81UKcRzRZ1IijgRX9npf6aPXRaD3mYcvdN9M1H3bTtwA3v4WwRIRq-yxUH5ohj_KPk9TYjLL3iJsQ5vcJZbtFKHNkR93PNYPg8p2G5g0XKbyho_s_3-oFIbkWtWsQCn3-5Nh6n4bTCn2YjPI6GS0noIy4hOV7LOwbteNzuyMRowa3Kgb2oWnAXhcxp8ESO8gK2xDTALroj97iD2S8g65iTrbW3KCTsA4whQSiMoAuBADqXIG")' }}
            ></div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary border-2 border-background-dark rounded-full"></div>
          </div>
          <div>
            <h2 className="text-white text-lg font-bold leading-tight">Good morning, Alex</h2>
            <p className="text-text-muted text-xs font-medium">Let's grow your network today.</p>
          </div>
        </div>
        <button className="flex w-10 h-10 items-center justify-center rounded-full bg-surface-card hover:bg-gray-700 transition-colors">
          <span className="material-symbols-outlined text-[24px]">notifications</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
        {/* Search Bar */}
        <div className="px-6 py-4">
          <div className="relative flex items-center h-14 w-full rounded-2xl bg-surface-card shadow-lg transition-all group focus-within:ring-2 focus-within:ring-primary/20">
            <div className="absolute left-4 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined icon-filled">colors_spark</span>
            </div>
            <input 
              className="h-full w-full rounded-2xl border-none bg-transparent pl-12 pr-12 text-base font-medium text-white placeholder:text-text-muted/60 focus:ring-0 outline-none" 
              placeholder="Ask Summer Loop... (e.g. Intro to Sarah)" 
              type="text"
            />
            <div className="absolute right-4 flex items-center justify-center text-text-muted cursor-pointer" onClick={() => onNavigate('voice')}>
              <span className="material-symbols-outlined">mic</span>
            </div>
          </div>
        </div>

        {/* Network Stats */}
        <div className="px-6 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col justify-between rounded-2xl bg-surface-card p-5 border border-transparent hover:border-primary/10 transition-colors">
              <div className="flex items-start justify-between">
                <div className="rounded-full bg-background-dark p-2 text-primary">
                  <span className="material-symbols-outlined text-[20px]">groups</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  12%
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold tracking-tight text-white">1,240</p>
                <p className="text-xs font-medium text-text-muted">Total Contacts</p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl bg-surface-card p-5 border border-transparent hover:border-primary/10 transition-colors">
              <div className="flex items-start justify-between">
                <div className="rounded-full bg-background-dark p-2 text-accent/90">
                  <span className="material-symbols-outlined text-[20px] text-yellow-500">handshake</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                  <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                  5%
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold tracking-tight text-white">78%</p>
                <p className="text-xs font-medium text-text-muted">Avg Relationship</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-4">
          <div className="flex gap-4">
            <button onClick={() => onNavigate('scan')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-dark text-background-dark h-12 px-4 shadow-glow transition-all active:scale-95">
              <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
              <span className="text-sm font-bold">Scan Card</span>
            </button>
            <button onClick={() => setShowNoteModal(true)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-card border border-gray-700 text-white h-12 px-4 hover:bg-gray-800 transition-all active:scale-95">
              <span className="material-symbols-outlined text-[20px] text-primary">edit_note</span>
              <span className="text-sm font-bold">Quick Note</span>
            </button>
          </div>
        </div>

        {/* Opportunities List */}
        <div className="px-6 pt-2 pb-2 flex items-center justify-between">
          <h3 className="text-white text-lg font-bold leading-tight">Suggested Opportunities</h3>
          <button 
            onClick={() => setShowAllOpportunities(true)}
            className="text-primary text-sm font-semibold hover:underline"
          >
            View All
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 pb-6">
          {/* Card 1 */}
          <div 
            onClick={() => onNavigate('path')}
            className="group relative flex flex-col gap-4 rounded-2xl bg-surface-card p-5 transition-all hover:bg-gray-800 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div 
                  className="w-12 h-12 rounded-xl bg-gray-700 bg-center bg-cover" 
                  style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBpDk3iGSfNytBgrSaLZ5PYOmvLP4ftPsd2JVcQvOw4Lcy3IujqD8Q9n16COvVIDptEyRSxXk4sef9BpH22iudIzG92--HPFqo-DWFXSChqn4w4mqff4JyYKGAkQKSTbbqDROFC9Ai0_P7eZzYctuEtUUeDcJ-AAwMM8x_1I2kyKINHbyvqWO2tIHrSCqNrtVTE1jHf2ZsL41pev2APyaJCGoVIgmxALdJKIotpx_RD6FfFeSJvB46kq86KddSrBst4jaBFsLE_fw7G")' }}
                ></div>
                <div>
                  <h4 className="font-bold text-white text-base">Sarah Chen</h4>
                  <p className="text-xs text-text-muted font-medium">VP Engineering @ TechCorp</p>
                  <div className="mt-1 inline-flex items-center rounded-md bg-green-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">
                    Strongest Path
                  </div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-primary transition-colors">
                <span className="material-symbols-outlined">more_horiz</span>
              </button>
            </div>

            {/* Path Visual */}
            <div className="relative mt-1 rounded-xl bg-background-dark p-3">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex flex-col items-center gap-1 w-16 text-center">
                  <div className="w-8 h-8 rounded-full border-2 border-surface-card bg-cover bg-center" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDK8ukbe3JY8du_VVFhK-Bm5fF_lcil81UKcRzRZ1IijgRX9npf6aPXRaD3mYcvdN9M1H3bTtwA3v4WwRIRq-yxUH5ohj_KPk9TYjLL3iJsQ5vcJZbtFKHNkR93PNYPg8p2G5g0XKbyho_s_3-oFIbkWtWsQCn3-5Nh6n4bTCn2YjPI6GS0noIy4hOV7LOwbteNzuyMRowa3Kgb2oWnAXhcxp8ESO8gK2xDTALroj97iD2S8g65iTrbW3KCTsA4whQSiMoAuBADqXIG")' }}></div>
                  <span className="text-[10px] font-bold text-text-muted">You</span>
                </div>
                <div className="h-0.5 flex-1 bg-primary/30 mx-1 relative">
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-[8px] text-background-dark font-bold">check</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 w-16 text-center">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full border-2 border-surface-card bg-cover bg-center" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCi_QmdkvF_abTtSLNpsYBP7O8YDBf03neIJ2WhyguOvmao1IL70Py370d1sRedJCF66VTV64n0qdaHXHgmSHbGWEX42LZaf-gFf9uNJalM4QMHNlhBcp5pUzSsUh87KutnpkjNBf1mn_wDvVm0dArh3VpZVlAwdAAcf9XqvJtXvch8Eu1HJNnpmUaYtsaYwCRGqjkzLtYzjL5SD9KhKkpW2Gg4dHXFfO06WAFDc5eCtkivZb809YLU-eLJPYd0WT7uPtXaoAldFtur")' }}></div>
                    <div className="absolute -right-1 -bottom-1 bg-primary text-background-dark text-[8px] px-1 rounded-full border border-background-dark font-bold">1st</div>
                  </div>
                  <span className="text-[10px] font-bold text-white">Mark</span>
                </div>
                <div className="h-0.5 flex-1 bg-primary/30 mx-1 relative">
                   <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-[8px] text-background-dark font-bold">bolt</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 w-16 text-center opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-600 bg-cover bg-center" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDgV4xP4XR-4zwjRl_BNrOjFLXHOby_ihDUTQqF6Kv6-hekZBkfgDGEKaTrKuDBpPnel27DV260vrkNqaVXQ3qcBMfk7cHK7Yrl2T78614pGn0ShjRdIWkyPQzfpB3yHnOeRbMg0KQ1h-72LxLJnBT29Fuvl-W6sNT77EKpvC9gfFII2smokDNRAk1Bqb7Mtvo0yACMvh_Rh4UMp9Cec4m2QSdXgIG7IiRS-dwH86iQZ_lp8Cwyr5FzwyFw9CljpZKwIl7RNuqiljzO")' }}></div>
                  <span className="text-[10px] font-bold text-text-muted">Sarah</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group relative flex flex-col gap-4 rounded-2xl bg-surface-card p-5 transition-all hover:bg-gray-800">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div 
                  className="w-12 h-12 rounded-xl bg-gray-700 bg-center bg-cover" 
                  style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDfvKukurdN39N5zKyre4x9vdl5o0oriTTLjV_zA8iXUBTYnSyZibrG4870uYpwJBWxuRbzuNvmNEzwM289knGwW1JkEwYVpQm05xeunE7DqX_e40x7FP3nBDxkZG181f6_YH84G5VjWEqTmCjRB7-pE4AlnMTfskFN3D48NAH4XcJiHPbsLJtMxH0Ou4zjzuYHG-mBm1_bLGPWIigyUrbhAq2hwa4HAZ7p3z7IYHR5H7fP_bHkSaOURJYNzpQQPr8DQp08g5mPh4wH")' }}
                ></div>
                <div>
                  <h4 className="font-bold text-white text-base">David Miller</h4>
                  <p className="text-xs text-text-muted font-medium">Founder @ GreenLoop</p>
                  <div className="mt-1 inline-flex items-center rounded-md bg-yellow-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-500">
                    2nd Degree
                  </div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-primary transition-colors">
                <span className="material-symbols-outlined">more_horiz</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  );
};

export default Dashboard;