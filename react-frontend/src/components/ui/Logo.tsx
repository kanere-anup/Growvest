import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'full' | 'icon';
}

const sizeClasses = {
  sm: { icon: 'w-8 h-8', text: 'text-lg' },
  md: { icon: 'w-10 h-10', text: 'text-xl' },
  lg: { icon: 'w-12 h-12', text: 'text-2xl' },
  xl: { icon: 'w-16 h-16', text: 'text-3xl' },
};

export function Logo({ className, size = 'md', showText = true, variant = 'full' }: LogoProps) {
  const sizeClass = sizeClasses[size];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Logo Icon */}
      <div className={cn('relative', sizeClass.icon)}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Background Circle with Gradient */}
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#059669" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id="arrowGradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Main Circle */}
          <circle 
            cx="50" 
            cy="50" 
            r="46" 
            fill="url(#logoGradient)"
            className="drop-shadow-lg"
          />
          
          {/* Inner Ring */}
          <circle 
            cx="50" 
            cy="50" 
            r="40" 
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />
          
          {/* Growth Chart / Arrow */}
          <g filter="url(#glow)">
            {/* Bar 1 */}
            <rect 
              x="22" 
              y="55" 
              width="12" 
              height="20" 
              rx="2"
              fill="rgba(255,255,255,0.3)"
            />
            
            {/* Bar 2 */}
            <rect 
              x="38" 
              y="45" 
              width="12" 
              height="30" 
              rx="2"
              fill="rgba(255,255,255,0.5)"
            />
            
            {/* Bar 3 */}
            <rect 
              x="54" 
              y="35" 
              width="12" 
              height="40" 
              rx="2"
              fill="rgba(255,255,255,0.7)"
            />
            
            {/* Growth Arrow */}
            <path 
              d="M26 50 L44 38 L58 28 L72 20" 
              stroke="url(#arrowGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            
            {/* Arrow Head */}
            <path 
              d="M66 18 L74 17 L75 25" 
              stroke="url(#arrowGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </g>
          
          {/* Subtle shine effect */}
          <ellipse 
            cx="35" 
            cy="30" 
            rx="20" 
            ry="15"
            fill="rgba(255,255,255,0.1)"
          />
        </svg>
      </div>

      {/* Logo Text */}
      {showText && variant === 'full' && (
        <div className="flex flex-col">
          <span className={cn(
            'font-display font-bold tracking-tight leading-none',
            sizeClass.text
          )}>
            <span className="text-primary-500">Grow</span>
            <span className="text-theme-primary">Vest</span>
          </span>
          {size === 'xl' && (
            <span className="text-xs text-theme-tertiary tracking-widest uppercase mt-1">
              Smart Stock Screening
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Simplified icon-only version for favicon etc.
export function LogoIcon({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
    >
      <defs>
        <linearGradient id="logoGradientIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="arrowGradientIcon" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>
      
      <circle cx="50" cy="50" r="46" fill="url(#logoGradientIcon)" />
      
      <rect x="22" y="55" width="12" height="20" rx="2" fill="rgba(255,255,255,0.3)" />
      <rect x="38" y="45" width="12" height="30" rx="2" fill="rgba(255,255,255,0.5)" />
      <rect x="54" y="35" width="12" height="40" rx="2" fill="rgba(255,255,255,0.7)" />
      
      <path 
        d="M26 50 L44 38 L58 28 L72 20" 
        stroke="url(#arrowGradientIcon)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path 
        d="M66 18 L74 17 L75 25" 
        stroke="url(#arrowGradientIcon)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}




