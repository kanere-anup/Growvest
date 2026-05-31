import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Logo } from '@/components/ui/Logo';
import { Mail, Lock, AlertCircle, Loader2, Sparkles, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoginCredentials } from '@/types';

export function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
            {['Real-time Data', '11 Strategies', '174 NSE Stocks'].map((feature, index) => (
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

            {/* Google OAuth */}
            <div className="mb-6">
              <a
                href="http://localhost:8080/api/v1/auth/google"
                className={cn(
                  "flex items-center justify-center gap-3 w-full py-3 rounded-xl font-medium transition-all duration-200 border",
                  theme === 'dark'
                    ? "bg-surface-800 hover:bg-surface-700 border-surface-700 text-theme-primary"
                    : "bg-white hover:bg-surface-50 border-surface-300 text-surface-700"
                )}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </a>
            </div>

            <div className="relative mb-6">
              <div className={cn(
                "absolute inset-0 flex items-center",
              )}>
                <div className={cn(
                  "w-full border-t",
                  theme === 'dark' ? "border-surface-700" : "border-surface-200"
                )} />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={cn(
                  "px-4",
                  theme === 'dark' ? "bg-surface-900 text-surface-400" : "bg-white text-surface-500"
                )}>or sign in with email</span>
              </div>
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
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className={cn("input pl-11 pr-11", errors.password && "input-error")}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-theme-tertiary hover:text-theme-secondary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
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
