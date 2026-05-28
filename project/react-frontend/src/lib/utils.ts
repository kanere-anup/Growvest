import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercentage(value: number, decimals = 2): string {
  return `${formatNumber(value, decimals)}%`;
}

export function formatCompactNumber(value: number): string {
  const formatter = new Intl.NumberFormat('en', {
    notation: 'compact',
    compactDisplay: 'short',
  });
  return formatter.format(value);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

export function getSignalColor(signal: string): string {
  switch (signal) {
    case 'buy':
      return 'text-green-500';
    case 'sell':
      return 'text-red-500';
    case 'hold':
      return 'text-yellow-500';
    default:
      return 'text-gray-500';
  }
}

export function getSignalBgColor(signal: string): string {
  switch (signal) {
    case 'buy':
      return 'bg-green-500/10 text-green-500';
    case 'sell':
      return 'bg-red-500/10 text-red-500';
    case 'hold':
      return 'bg-yellow-500/10 text-yellow-500';
    default:
      return 'bg-gray-500/10 text-gray-500';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500/10 text-green-500';
    case 'running':
      return 'bg-blue-500/10 text-blue-500';
    case 'pending':
      return 'bg-yellow-500/10 text-yellow-500';
    case 'failed':
      return 'bg-red-500/10 text-red-500';
    case 'cancelled':
      return 'bg-gray-500/10 text-gray-500';
    default:
      return 'bg-gray-500/10 text-gray-500';
  }
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

