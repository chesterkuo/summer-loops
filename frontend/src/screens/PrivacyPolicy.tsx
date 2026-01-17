import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
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
            <div className="flex gap-2">
              <button
                onClick={() => changeLanguage('en')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  i18n.language === 'en' ? 'bg-primary text-background-dark' : 'bg-surface-card text-text-muted hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => changeLanguage('zh-TW')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  i18n.language === 'zh-TW' ? 'bg-primary text-background-dark' : 'bg-surface-card text-text-muted hover:text-white'
                }`}
              >
                繁中
              </button>
              <button
                onClick={() => changeLanguage('zh-CN')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  i18n.language === 'zh-CN' ? 'bg-primary text-background-dark' : 'bg-surface-card text-text-muted hover:text-white'
                }`}
              >
                简中
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="px-6 py-8">
          <h1 className="text-2xl font-bold text-white mb-2">{t('privacy.title')}</h1>
          <p className="text-text-muted text-sm mb-8">{t('privacy.lastUpdated')}: 2025-01-17</p>

          <div className="space-y-6 text-gray-300">
            {/* Introduction */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('privacy.sections.intro.title')}</h2>
              <p className="text-sm leading-relaxed">{t('privacy.sections.intro.content')}</p>
            </section>

            {/* Information We Collect */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('privacy.sections.collection.title')}</h2>
              <p className="text-sm leading-relaxed">{t('privacy.sections.collection.content')}</p>
            </section>

            {/* How We Use Information */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('privacy.sections.usage.title')}</h2>
              <p className="text-sm leading-relaxed">{t('privacy.sections.usage.content')}</p>
            </section>

            {/* Data Storage */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('privacy.sections.storage.title')}</h2>
              <p className="text-sm leading-relaxed">{t('privacy.sections.storage.content')}</p>
            </section>

            {/* Data Sharing */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('privacy.sections.sharing.title')}</h2>
              <p className="text-sm leading-relaxed">{t('privacy.sections.sharing.content')}</p>
            </section>

            {/* Your Rights */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('privacy.sections.rights.title')}</h2>
              <p className="text-sm leading-relaxed">{t('privacy.sections.rights.content')}</p>
            </section>

            {/* Security */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('privacy.sections.security.title')}</h2>
              <p className="text-sm leading-relaxed">{t('privacy.sections.security.content')}</p>
            </section>

            {/* Children's Privacy */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('privacy.sections.children.title')}</h2>
              <p className="text-sm leading-relaxed">{t('privacy.sections.children.content')}</p>
            </section>

            {/* Changes to Policy */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('privacy.sections.changes.title')}</h2>
              <p className="text-sm leading-relaxed">{t('privacy.sections.changes.content')}</p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('privacy.sections.contact.title')}</h2>
              <p className="text-sm leading-relaxed">{t('privacy.sections.contact.content')}</p>
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="px-6 py-8 border-t border-gray-800">
          <div className="flex items-center justify-center gap-4 text-sm text-text-muted">
            <Link to="/tos" className="hover:text-primary transition-colors">{t('tos.title')}</Link>
            <span>|</span>
            <Link to="/" className="hover:text-primary transition-colors">{t('common.back')}</Link>
          </div>
          <p className="text-center text-xs text-text-muted mt-4">
            &copy; 2025 Warmly. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
