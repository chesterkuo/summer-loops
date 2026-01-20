import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const Support: React.FC = () => {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="flex justify-center min-h-screen bg-black">
      <div className="w-full max-w-2xl bg-background-dark min-h-screen shadow-2xl border-x border-gray-800">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background-dark/95 backdrop-blur-sm border-b border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-primary hover:text-primary-light transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
              <span className="text-sm font-medium">{t('common.back')}</span>
            </Link>

            {/* Language Selector */}
            <div className="flex flex-wrap gap-1.5 justify-end">
              {[
                { code: 'en', label: 'EN' },
                { code: 'zh-TW', label: '繁' },
                { code: 'zh-CN', label: '简' },
                { code: 'ja', label: '日' },
                { code: 'ko', label: '한' },
                { code: 'vi', label: 'VI' },
                { code: 'th', label: 'ไทย' },
                { code: 'es', label: 'ES' },
                { code: 'fr', label: 'FR' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                    i18n.language === lang.code ? 'bg-primary text-background-dark' : 'bg-surface-card text-text-muted hover:text-white'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="px-6 py-8">
          <h1 className="text-2xl font-bold text-white mb-2">{t('support.title')}</h1>
          <p className="text-text-muted text-sm mb-8">{t('support.subtitle')}</p>

          <div className="space-y-6 text-gray-300">
            {/* Contact Us */}
            <section className="bg-surface-card rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">mail</span>
                {t('support.sections.contact.title')}
              </h2>
              <p className="text-sm leading-relaxed mb-4">{t('support.sections.contact.content')}</p>
              <a
                href="mailto:support@mywarmly.app"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-background-dark rounded-lg font-medium text-sm hover:bg-primary-light transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                support@mywarmly.app
              </a>
            </section>

            {/* FAQ */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">help</span>
                {t('support.sections.faq.title')}
              </h2>

              <div className="space-y-4">
                <div className="bg-surface-card rounded-xl p-4 border border-gray-800">
                  <h3 className="font-medium text-white mb-2">{t('support.sections.faq.q1.question')}</h3>
                  <p className="text-sm text-gray-400">{t('support.sections.faq.q1.answer')}</p>
                </div>

                <div className="bg-surface-card rounded-xl p-4 border border-gray-800">
                  <h3 className="font-medium text-white mb-2">{t('support.sections.faq.q2.question')}</h3>
                  <p className="text-sm text-gray-400">{t('support.sections.faq.q2.answer')}</p>
                </div>

                <div className="bg-surface-card rounded-xl p-4 border border-gray-800">
                  <h3 className="font-medium text-white mb-2">{t('support.sections.faq.q3.question')}</h3>
                  <p className="text-sm text-gray-400">{t('support.sections.faq.q3.answer')}</p>
                </div>

                <div className="bg-surface-card rounded-xl p-4 border border-gray-800">
                  <h3 className="font-medium text-white mb-2">{t('support.sections.faq.q4.question')}</h3>
                  <p className="text-sm text-gray-400">{t('support.sections.faq.q4.answer')}</p>
                </div>
              </div>
            </section>

            {/* Response Time */}
            <section className="bg-surface-card rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">schedule</span>
                {t('support.sections.response.title')}
              </h2>
              <p className="text-sm leading-relaxed">{t('support.sections.response.content')}</p>
            </section>

            {/* App Info */}
            <section className="bg-surface-card rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">info</span>
                {t('support.sections.appInfo.title')}
              </h2>
              <div className="text-sm space-y-2">
                <p><span className="text-gray-400">{t('support.sections.appInfo.version')}:</span> <span className="text-white">1.0.0</span></p>
                <p><span className="text-gray-400">{t('support.sections.appInfo.developer')}:</span> <span className="text-white">Warmly Team</span></p>
              </div>
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="px-6 py-8 border-t border-gray-800">
          <div className="flex items-center justify-center gap-4 text-sm text-text-muted">
            <Link to="/tos" className="hover:text-primary transition-colors">{t('tos.title')}</Link>
            <span>|</span>
            <Link to="/privacy" className="hover:text-primary transition-colors">{t('privacy.title')}</Link>
            <span>|</span>
            <Link to="/" className="hover:text-primary transition-colors">{t('common.back')}</Link>
          </div>
          <p className="text-center text-xs text-text-muted mt-4">
            &copy; 2026 Summer Lab. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Support;
