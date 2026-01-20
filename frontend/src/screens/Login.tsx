import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface LoginProps {
  onAuthenticated: () => void;
}

const Login: React.FC<LoginProps> = ({ onAuthenticated }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { login, signup, isLoading, error, clearError, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      onAuthenticated();
    }
  }, [isAuthenticated, onAuthenticated]);

  useEffect(() => {
    clearError();
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    let success = false;
    if (mode === 'login') {
      success = await login(email, password);
    } else {
      if (!name.trim()) {
        return;
      }
      success = await signup(email, password, name);
    }

    if (success) {
      onAuthenticated();
    }
  };

  const isFormValid = mode === 'login'
    ? email && password.length >= 6
    : email && password.length >= 6 && name.trim();

  return (
    <div className="flex flex-col h-full bg-background-dark font-display text-white">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Logo */}
        <div className="mb-8 md:mb-12 text-center">
          <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
            <span className="material-symbols-outlined text-4xl md:text-6xl text-background-dark icon-filled">diversity_3</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">Warmly</h1>
          <p className="text-text-muted text-sm md:text-base mt-1">{t('login.tagline', 'Your professional network, simplified')}</p>
        </div>

        {/* Form Card */}
        <div className="w-full max-w-sm md:max-w-md">
          {/* Mode Toggle */}
          <div className="flex rounded-xl bg-surface-card p-1 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                mode === 'login'
                  ? 'bg-primary text-background-dark'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              {t('login.signIn', 'Sign In')}
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                mode === 'signup'
                  ? 'bg-primary text-background-dark'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              {t('login.signUp', 'Sign Up')}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  {t('login.name', 'Name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('login.namePlaceholder', 'Enter your name')}
                  className="w-full h-12 px-4 rounded-xl bg-surface-card border border-gray-700 text-white placeholder:text-gray-500 focus:border-primary outline-none transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                {t('login.email', 'Email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder', 'Enter your email')}
                className="w-full h-12 px-4 rounded-xl bg-surface-card border border-gray-700 text-white placeholder:text-gray-500 focus:border-primary outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                {t('login.password', 'Password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder', 'Enter your password')}
                  className="w-full h-12 px-4 pr-12 rounded-xl bg-surface-card border border-gray-700 text-white placeholder:text-gray-500 focus:border-primary outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {mode === 'signup' && (
                <p className="text-xs text-text-muted mt-1">
                  {t('login.passwordHint', 'Minimum 6 characters')}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary-dark text-background-dark font-bold text-sm transition-all shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-background-dark border-t-transparent"></span>
                  {t('common.loading', 'Loading...')}
                </span>
              ) : mode === 'login' ? (
                t('login.signInButton', 'Sign In')
              ) : (
                t('login.signUpButton', 'Create Account')
              )}
            </button>
          </form>

        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 text-center">
        <p className="text-xs text-text-muted">
          {t('login.termsPrefix', 'By continuing, you agree to our')}{' '}
          <Link to="/tos" className="text-primary hover:underline">{t('tos.title', 'Terms of Service')}</Link>
          {' '}{t('login.and', 'and')}{' '}
          <Link to="/privacy" className="text-primary hover:underline">{t('privacy.title', 'Privacy Policy')}</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
