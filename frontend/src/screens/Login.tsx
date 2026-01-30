import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/api';

interface LoginProps {
  onAuthenticated: () => void;
}

const Login: React.FC<LoginProps> = ({ onAuthenticated }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgotPassword' | 'enterCode' | 'newPassword'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Password reset state
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const { login, signup, isLoading, error, clearError, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      onAuthenticated();
    }
  }, [isAuthenticated, onAuthenticated]);

  useEffect(() => {
    clearError();
    setResetError('');
    setResetSuccess('');
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);

    try {
      const result = await authApi.forgotPassword(email);
      if (result.error) {
        setResetError(result.error);
      } else {
        setMode('enterCode');
      }
    } catch {
      setResetError('Network error');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (!/^\d{6}$/.test(resetCode)) {
      setResetError(t('login.enterCode', 'Enter Code'));
      return;
    }

    setMode('newPassword');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (newPassword.length < 6) {
      setResetError(t('login.passwordHint', 'Minimum 6 characters'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError(t('login.passwordsDoNotMatch', 'Passwords do not match'));
      return;
    }

    setResetLoading(true);
    try {
      const result = await authApi.resetPassword(email, resetCode, newPassword);
      if (result.error) {
        setResetError(result.error);
      } else {
        setResetSuccess(t('login.passwordResetSuccess', 'Password reset successfully. You can now sign in.'));
        setResetCode('');
        setNewPassword('');
        setConfirmPassword('');
        setPassword('');
        setMode('login');
      }
    } catch {
      setResetError('Network error');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResetError('');
    setResetLoading(true);
    try {
      await authApi.forgotPassword(email);
      setResetError('');
      setResetSuccess(t('login.codeSent', 'A new code has been sent to your email.'));
      setTimeout(() => setResetSuccess(''), 4000);
    } catch {
      setResetError('Network error');
    } finally {
      setResetLoading(false);
    }
  };

  const backToLogin = () => {
    setMode('login');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setResetSuccess('');
  };

  const isResetFlow = mode === 'forgotPassword' || mode === 'enterCode' || mode === 'newPassword';

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
          {/* Mode Toggle — only show for login/signup */}
          {!isResetFlow && (
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
          )}

          {/* Reset flow header */}
          {isResetFlow && (
            <div className="mb-6">
              <button
                onClick={backToLogin}
                className="flex items-center gap-1 text-text-muted hover:text-white text-sm mb-4 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                {t('login.backToSignIn', 'Back to Sign In')}
              </button>
              <h2 className="text-xl font-bold">
                {mode === 'forgotPassword' && t('login.forgotPassword', 'Forgot Password?')}
                {mode === 'enterCode' && t('login.checkEmail', 'Check Your Email')}
                {mode === 'newPassword' && t('login.setNewPassword', 'Set New Password')}
              </h2>
              <p className="text-text-muted text-sm mt-1">
                {mode === 'forgotPassword' && t('login.forgotPasswordDesc', 'Enter your email and we\'ll send you a reset code.')}
                {mode === 'enterCode' && t('login.checkEmailDesc', 'Enter the 6-digit code sent to your email.')}
                {mode === 'newPassword' && t('login.setNewPassword', 'Set New Password')}
              </p>
            </div>
          )}

          {/* Success Message */}
          {resetSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
              {resetSuccess}
            </div>
          )}

          {/* Error Message */}
          {(error || resetError) && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error || resetError}
            </div>
          )}

          {/* Login / Signup Form */}
          {(mode === 'login' || mode === 'signup') && (
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
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgotPassword')}
                    className="text-xs text-primary hover:underline mt-1.5 block"
                  >
                    {t('login.forgotPassword', 'Forgot Password?')}
                  </button>
                )}
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
          )}

          {/* Forgot Password Form */}
          {mode === 'forgotPassword' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
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

              <button
                type="submit"
                disabled={resetLoading || !email}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary-dark text-background-dark font-bold text-sm transition-all shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-background-dark border-t-transparent"></span>
                    {t('common.loading', 'Loading...')}
                  </span>
                ) : (
                  t('login.sendResetCode', 'Send Reset Code')
                )}
              </button>
            </form>
          )}

          {/* Enter Code Form */}
          {mode === 'enterCode' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  {t('login.enterCode', 'Enter Code')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('login.codePlaceholder', '000000')}
                  className="w-full h-14 px-4 rounded-xl bg-surface-card border border-gray-700 text-white text-center text-2xl font-mono tracking-[0.5em] placeholder:text-gray-500 focus:border-primary outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={resetCode.length !== 6}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary-dark text-background-dark font-bold text-sm transition-all shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('login.verifyCode', 'Verify Code')}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={resetLoading}
                className="w-full text-center text-sm text-primary hover:underline disabled:opacity-50"
              >
                {t('login.resendCode', 'Resend Code')}
              </button>
            </form>
          )}

          {/* New Password Form */}
          {mode === 'newPassword' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  {t('login.newPassword', 'New Password')}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('login.newPasswordPlaceholder', 'Enter new password')}
                  className="w-full h-12 px-4 rounded-xl bg-surface-card border border-gray-700 text-white placeholder:text-gray-500 focus:border-primary outline-none transition-colors"
                />
                <p className="text-xs text-text-muted mt-1">
                  {t('login.passwordHint', 'Minimum 6 characters')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  {t('login.confirmPassword', 'Confirm Password')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('login.confirmPasswordPlaceholder', 'Confirm new password')}
                  className="w-full h-12 px-4 rounded-xl bg-surface-card border border-gray-700 text-white placeholder:text-gray-500 focus:border-primary outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading || newPassword.length < 6 || !confirmPassword}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary-dark text-background-dark font-bold text-sm transition-all shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-background-dark border-t-transparent"></span>
                    {t('common.loading', 'Loading...')}
                  </span>
                ) : (
                  t('login.resetPasswordButton', 'Reset Password')
                )}
              </button>
            </form>
          )}

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
