import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Logo } from '@/components/ui/Logo';
import {
  LayoutDashboard,
  LineChart,
  Layers,
  Scan,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Info,
  ChevronDown,
  User,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/stocks', label: 'Stocks', icon: TrendingUp },
  { path: '/strategies', label: 'Strategies', icon: Layers },
  { path: '/scans', label: 'Scans', icon: Scan },
  { path: '/analytics', label: 'Analytics', icon: LineChart },
  { path: '/about', label: 'About', icon: Info },
];

export function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  if (!isAuthenticated) return null;

  return (
    <header className="sticky top-0 z-50 glass-dark border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="group">
            <Logo size="md" className="group-hover:opacity-90 transition-opacity" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary-500/10 text-primary-500 border border-primary-500/20'
                      : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Side Actions */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={cn(
                "p-2.5 rounded-xl transition-all duration-300",
                theme === 'dark' 
                  ? "bg-surface-800/50 hover:bg-surface-700 text-yellow-400"
                  : "bg-surface-100 hover:bg-surface-200 text-surface-600"
              )}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 rounded-xl border transition-all",
                  theme === 'dark'
                    ? "bg-surface-800/50 border-surface-700/50 hover:border-surface-600"
                    : "bg-white border-surface-200 hover:border-surface-300"
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500/20 to-primary-500/5 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-500" />
                </div>
                <span className="text-sm font-medium text-theme-primary max-w-[120px] truncate">
                  {user?.full_name || user?.email?.split('@')[0]}
                </span>
                <ChevronDown className={cn(
                  "w-4 h-4 text-theme-secondary transition-transform",
                  userMenuOpen && "rotate-180"
                )} />
              </button>

              {userMenuOpen && (
                <div className={cn(
                  "absolute right-0 mt-2 w-48 py-2 rounded-xl shadow-xl animate-slide-down border",
                  theme === 'dark'
                    ? "bg-surface-800 border-surface-700"
                    : "bg-white border-surface-200"
                )}>
                  <div className={cn(
                    "px-4 py-2 border-b",
                    theme === 'dark' ? "border-surface-700" : "border-surface-200"
                  )}>
                    <p className="text-sm font-medium text-theme-primary">{user?.full_name}</p>
                    <p className="text-xs text-theme-tertiary">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-2 text-sm text-danger-500 transition-colors",
                      theme === 'dark' ? "hover:bg-surface-700/50" : "hover:bg-danger-50"
                    )}
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            {/* Mobile Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' 
                  ? "bg-surface-800/50 text-yellow-400"
                  : "bg-surface-100 text-surface-600"
              )}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            
            <button
              className="p-2 rounded-xl hover:bg-theme-tertiary text-theme-secondary"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="lg:hidden py-4 border-t animate-slide-down">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-500/10 text-primary-500'
                      : 'text-theme-secondary hover:bg-theme-tertiary hover:text-theme-primary'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-4 pt-4 border-t">
              <div className="px-4 py-2 mb-2">
                <p className="text-sm font-medium text-theme-primary">{user?.full_name}</p>
                <p className="text-xs text-theme-tertiary">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-danger-500 hover:bg-danger-500/10"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
