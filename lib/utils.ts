import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF'
  }).format(value);
}

export function formatCurrencyValue(value: number): string {
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('it-IT').format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value / 100);
}

export function getHealthScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

export function getHealthScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500/10 border-green-500/20';
  if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/20';
  if (score >= 40) return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export function getChurnRiskColor(risk: number): string {
  if (risk >= 70) return 'text-red-500';
  if (risk >= 40) return 'text-orange-500';
  return 'text-green-500';
}

export function getPriorityBadgeColor(priority: 'urgent' | 'high' | 'medium' | 'low'): string {
  const colors = {
    urgent: 'bg-red-500 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-white',
    low: 'bg-green-500 text-white'
  };
  return colors[priority];
}
