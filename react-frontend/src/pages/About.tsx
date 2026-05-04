import { MainLayout } from '@/components/layout/MainLayout';
import { useTheme } from '@/context/ThemeContext';
import { Logo } from '@/components/ui/Logo';
import { 
  TrendingUp, 
  Shield, 
  Zap, 
  Target, 
  Users, 
  Award,
  BarChart3,
  ArrowRight,
  Mail,
  Sparkles,
  Heart,
  Linkedin,
  Code2,
  Lightbulb
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function About() {
  const { theme } = useTheme();

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Lightning Fast',
      description: 'Scan hundreds of stocks in seconds with our optimized backend engine.',
      color: 'warning',
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: 'Multiple Strategies',
      description: 'Choose from AVWAP, 52-Week Extremes, Volume Breakout, Momentum, and more.',
      color: 'primary',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Enterprise Security',
      description: 'Bank-level encryption and secure authentication to protect your data.',
      color: 'success',
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Advanced Analytics',
      description: 'Track performance, analyze trends, and make data-driven decisions.',
      color: 'info',
    },
  ];

  const stats = [
    { value: '500+', label: 'NSE Stocks', icon: <TrendingUp className="w-5 h-5" /> },
    { value: '4+', label: 'Strategies', icon: <Target className="w-5 h-5" /> },
    { value: '99.9%', label: 'Uptime', icon: <Zap className="w-5 h-5" /> },
    { value: '24/7', label: 'Support', icon: <Users className="w-5 h-5" /> },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      primary: { bg: 'bg-primary-500/10', text: 'text-primary-500', border: 'border-primary-500/20' },
      success: { bg: 'bg-success-500/10', text: 'text-success-500', border: 'border-success-500/20' },
      warning: { bg: 'bg-warning-500/10', text: 'text-warning-500', border: 'border-warning-500/20' },
      info: { bg: 'bg-info-500/10', text: 'text-info-500', border: 'border-info-500/20' },
    };
    return colors[color] || colors.primary;
  };

  return (
    <MainLayout>
      <div className="space-y-16">
        {/* Hero Section */}
        <section className="text-center max-w-4xl mx-auto animate-fade-in py-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Logo size="xl" />
          </div>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-medium text-primary-500">About GrowVest</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-display font-bold text-theme-primary mb-6">
            Empowering Investors with
            <span className="gradient-text block mt-2">Smart Stock Screening</span>
          </h1>
          
          <p className="text-lg md:text-xl text-theme-secondary max-w-2xl mx-auto mb-8">
            GrowVest is a powerful stock market screening and analysis platform built for 
            investors who want to make data-driven decisions with confidence.
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <Link to="/scans">
              <button className="btn-primary text-lg px-8 py-3">
                Start Scanning
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link to="/strategies">
              <button className="btn-secondary text-lg px-8 py-3">
                View Strategies
              </button>
            </Link>
          </div>
        </section>

        {/* Stats Section */}
        <section className="animate-slide-up">
          <div className={cn(
            "card p-8 md:p-12",
            theme === 'dark' ? "bg-gradient-to-r from-primary-500/5 to-transparent" : "bg-gradient-to-r from-primary-50 to-transparent"
          )}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className="text-center"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={cn(
                    "w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center",
                    theme === 'dark' ? "bg-primary-500/10 text-primary-500" : "bg-primary-100 text-primary-600"
                  )}>
                    {stat.icon}
                  </div>
                  <div className="text-3xl md:text-4xl font-display font-bold text-theme-primary mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-theme-secondary">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="animate-slide-up animate-delay-100">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold text-theme-primary mb-4">
              Why Choose GrowVest?
            </h2>
            <p className="text-theme-secondary max-w-xl mx-auto">
              Built with modern technology and designed for serious investors who demand the best tools.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => {
              const colorClasses = getColorClasses(feature.color);
              return (
                <div 
                  key={index} 
                  className="card-hover p-6 animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center border",
                      colorClasses.bg,
                      colorClasses.border
                    )}>
                      <span className={colorClasses.text}>{feature.icon}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-theme-primary mb-2">{feature.title}</h3>
                      <p className="text-theme-secondary">{feature.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Mission Section */}
        <section className="animate-slide-up animate-delay-200">
          <div className={cn(
            "card p-8 md:p-12 text-center",
            theme === 'dark' 
              ? "bg-gradient-to-br from-surface-800/50 to-surface-900/50"
              : "bg-gradient-to-br from-surface-50 to-white"
          )}>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
              <Heart className="w-8 h-8 text-primary-500" />
            </div>
            <h2 className="text-3xl font-display font-bold text-theme-primary mb-4">Our Mission</h2>
            <p className="text-lg text-theme-secondary max-w-2xl mx-auto">
              We believe every investor deserves access to professional-grade screening tools. 
              Our mission is to democratize stock market analysis and help you make smarter 
              investment decisions.
            </p>
          </div>
        </section>

        {/* Founder Section */}
        <section className="animate-slide-up animate-delay-250">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-display font-bold text-theme-primary mb-4">
              Meet the Founder
            </h2>
            <p className="text-theme-secondary max-w-xl mx-auto">
              The vision behind GrowVest
            </p>
          </div>
          
          <div className={cn(
            "card p-8 md:p-10 max-w-3xl mx-auto",
            theme === 'dark' 
              ? "bg-gradient-to-br from-surface-800/80 to-surface-900/80" 
              : "bg-gradient-to-br from-white to-surface-50"
          )}>
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Founder Image */}
              <div className="relative flex-shrink-0">
                <div className="w-40 h-40 rounded-2xl overflow-hidden border-4 border-primary-500/20 shadow-glow">
                  <img 
                    src="/images/founder.jpg" 
                    alt="Anup Kanere - Founder & CEO"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to initials if image not found
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden w-full h-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                    <span className="text-4xl font-bold text-white">AK</span>
                  </div>
                </div>
                {/* Decorative ring */}
                <div className="absolute -inset-2 rounded-2xl border border-primary-500/10 -z-10" />
              </div>
              
              {/* Founder Info */}
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-display font-bold text-theme-primary mb-1">
                  Anup Kanere
                </h3>
                <p className="text-primary-500 font-medium mb-4">Founder & CEO, GrowVest</p>
                
                <p className="text-theme-secondary mb-6 leading-relaxed">
                  A passionate Software Development Engineer with a vision to revolutionize 
                  how retail investors approach the stock market. Anup built GrowVest to bridge 
                  the gap between institutional-grade analysis tools and individual investors, 
                  making sophisticated stock screening accessible to everyone.
                </p>
                
                {/* Skills/Focus areas */}
                <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-6">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
                    theme === 'dark' 
                      ? "bg-surface-700 text-theme-secondary" 
                      : "bg-surface-100 text-theme-secondary"
                  )}>
                    <Code2 className="w-3.5 h-3.5" />
                    Full-Stack Development
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
                    theme === 'dark' 
                      ? "bg-surface-700 text-theme-secondary" 
                      : "bg-surface-100 text-theme-secondary"
                  )}>
                    <TrendingUp className="w-3.5 h-3.5" />
                    Financial Markets
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
                    theme === 'dark' 
                      ? "bg-surface-700 text-theme-secondary" 
                      : "bg-surface-100 text-theme-secondary"
                  )}>
                    <Lightbulb className="w-3.5 h-3.5" />
                    Product Innovation
                  </span>
                </div>
                
                {/* Social Links */}
                <div className="flex justify-center md:justify-start gap-3">
                  <a 
                    href="https://www.linkedin.com/in/02a021205" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all",
                      theme === 'dark'
                        ? "bg-[#0077B5]/20 text-[#0077B5] hover:bg-[#0077B5]/30"
                        : "bg-[#0077B5]/10 text-[#0077B5] hover:bg-[#0077B5]/20"
                    )}
                  >
                    <Linkedin className="w-4 h-4" />
                    Connect on LinkedIn
                  </a>
                  <a 
                    href="mailto:kanereanup@gmail.com"
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all",
                      theme === 'dark'
                        ? "bg-primary-500/20 text-primary-400 hover:bg-primary-500/30"
                        : "bg-primary-500/10 text-primary-600 hover:bg-primary-500/20"
                    )}
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Technology Section */}
        <section className="animate-slide-up animate-delay-300">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold text-theme-primary mb-4">
              Built with Modern Tech
            </h2>
            <p className="text-theme-secondary max-w-xl mx-auto">
              Powered by cutting-edge technologies for reliability and performance.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Go', desc: 'Backend' },
              { name: 'React', desc: 'Frontend' },
              { name: 'PostgreSQL', desc: 'Database' },
              { name: 'NSE API', desc: 'Data Source' },
            ].map((tech, index) => (
              <div 
                key={index}
                className={cn(
                  "card p-6 text-center",
                  theme === 'dark' ? "hover:bg-surface-800/50" : "hover:bg-surface-50"
                )}
              >
                <div className="text-2xl font-display font-bold text-theme-primary mb-1">{tech.name}</div>
                <div className="text-sm text-theme-tertiary">{tech.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="animate-slide-up animate-delay-400">
          <div className="card-glow p-8 md:p-12 text-center">
            <Award className="w-12 h-12 text-primary-500 mx-auto mb-6" />
            <h2 className="text-3xl font-display font-bold text-theme-primary mb-4">
              Ready to Start?
            </h2>
            <p className="text-lg text-theme-secondary max-w-xl mx-auto mb-8">
              Join GrowVest today and discover powerful stock screening capabilities.
            </p>
            <Link to="/scans">
              <button className="btn-primary text-lg px-10 py-4 shadow-glow">
                Start Your First Scan
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
          </div>
        </section>

        {/* Contact Section */}
        <section className="text-center pb-8 animate-slide-up animate-delay-500">
          <div className="flex items-center justify-center gap-2 text-theme-secondary">
            <Mail className="w-4 h-4" />
            <span>Questions? Contact us at </span>
            <a href="mailto:kanereanup@gmail.com" className="text-primary-500 hover:text-primary-400 font-medium">
            kanereanup@gmail.com
            </a>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
