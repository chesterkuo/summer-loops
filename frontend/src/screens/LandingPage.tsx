import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LandingPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-center min-h-screen bg-black md:bg-background-dark">
      <div className="w-full max-w-md md:max-w-2xl bg-background-dark min-h-screen flex flex-col shadow-2xl border-x border-gray-800 md:border-0 font-display text-white">
        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
              <span className="material-symbols-outlined text-4xl md:text-6xl text-background-dark icon-filled">diversity_3</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white">Warmly</h1>
            <p className="text-text-muted text-sm md:text-lg mt-2">{t('landing.tagline', 'Your professional network, simplified')}</p>
          </div>

          {/* Features */}
          <div className="w-full max-w-sm md:max-w-md space-y-4 mb-10">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-xl mt-0.5">photo_camera</span>
              <div>
                <p className="text-sm font-semibold">{t('landing.featureScanning', 'Business Card Scanning')}</p>
                <p className="text-xs text-text-muted">{t('landing.featureScanningDesc', 'Scan and save contacts instantly with your camera')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-xl mt-0.5">auto_awesome</span>
              <div>
                <p className="text-sm font-semibold">{t('landing.featureAI', 'AI-Powered Follow-Ups')}</p>
                <p className="text-xs text-text-muted">{t('landing.featureAIDesc', 'Get smart reminders and draft personalized messages')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-xl mt-0.5">hub</span>
              <div>
                <p className="text-sm font-semibold">{t('landing.featureNetwork', 'Network Visualization')}</p>
                <p className="text-xs text-text-muted">{t('landing.featureNetworkDesc', 'See your connections mapped out and discover paths')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-xl mt-0.5">calendar_month</span>
              <div>
                <p className="text-sm font-semibold">{t('landing.featureCalendar', 'Google Calendar Sync')}</p>
                <p className="text-xs text-text-muted">{t('landing.featureCalendarDesc', 'Sync reminders and follow-ups as calendar events')}</p>
              </div>
            </div>
          </div>

          {/* Sign In Button */}
          <Link
            to="/login"
            className="w-full max-w-sm h-12 rounded-xl bg-primary hover:bg-primary-dark text-background-dark font-bold text-sm transition-all shadow-glow flex items-center justify-center"
          >
            {t('landing.signIn', 'Sign In')}
          </Link>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 text-center">
          <p className="text-xs text-text-muted">
            <Link to="/privacy" className="text-primary hover:underline">{t('privacy.title', 'Privacy Policy')}</Link>
            {' · '}
            <Link to="/tos" className="text-primary hover:underline">{t('tos.title', 'Terms of Service')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
