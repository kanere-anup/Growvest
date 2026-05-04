import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Logo } from '@/components/ui/Logo';
import { Mail, Lock, AlertCircle, Loader2, Sparkles, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoginCredentials } from '@/types';

export function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>();

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setIsLoading(true);
      setError(null);
      await login(data);
      navigate(from, { replace: true });
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-theme-primary">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className={cn(
          "fixed top-6 right-6 p-3 rounded-xl z-50 transition-all duration-300 shadow-lg",
          theme === 'dark' 
            ? "bg-surface-800 hover:bg-surface-700 text-yellow-400"
            : "bg-white hover:bg-surface-50 text-surface-600 border border-surface-200"
        )}
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Effects */}
        <div className={cn(
          "absolute inset-0",
          theme === 'dark' 
            ? "bg-gradient-to-br from-primary-500/20 via-surface-900 to-surface-950"
            : "bg-gradient-to-br from-primary-50 via-white to-surface-50"
        )} />
        <div className={cn(
          "absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl",
          theme === 'dark' ? "bg-primary-500/10" : "bg-primary-200/50"
        )} />
        <div className={cn(
          "absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-2xl",
          theme === 'dark' ? "bg-primary-500/5" : "bg-primary-100/50"
        )} />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 py-12">
          <div className="mb-12">
            <Logo size="xl" />
          </div>
          
          <h1 className="text-4xl font-display font-bold text-theme-primary mb-4">
            Smart Stock Screening
            <br />
            <span className="gradient-text">for Smart Investors</span>
          </h1>
          
          <p className="text-lg text-theme-secondary mb-8 max-w-md">
            Discover market opportunities with advanced screening strategies and real-time data analysis.
          </p>
          
          <div className="flex flex-wrap gap-4">
            {['Real-time Data', '4+ Strategies', 'NSE Coverage'].map((feature, index) => (
              <div 
                key={index}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full border",
                  theme === 'dark'
                    ? "bg-surface-800/50 border-surface-700"
                    : "bg-white border-surface-200"
                )}
              >
                <Sparkles className="w-4 h-4 text-primary-500" />
                <span className="text-sm text-theme-secondary">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Logo size="lg" />
          </div>

          <div className="card animate-scale-in p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-bold text-theme-primary mb-2">Welcome back</h2>
              <p className="text-theme-secondary">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-tertiary" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className={cn("input pl-11", errors.email && "input-error")}
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-sm text-danger-500">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-tertiary" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className={cn("input pl-11", errors.password && "input-error")}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                    })}
                  />
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-sm text-danger-500">{errors.password.message}</p>
                )}
              </div>

              <button 
                type="submit" 
                className="btn-primary w-full py-3"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className={cn(
              "mt-8 pt-6 border-t text-center",
              theme === 'dark' ? "border-surface-800" : "border-surface-200"
            )}>
              <p className="text-sm text-theme-secondary">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary-500 font-medium hover:text-primary-400 transition-colors">
                  Sign up for free
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
