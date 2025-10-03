// ==================== IMAGE UTILITIES ====================

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function compressImage(
  base64: string,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = base64;
  });
}

// ==================== DATE UTILITIES ====================

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

// ==================== GEO UTILITIES ====================

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function hasMovedSignificantly(
  pos1: { lat: number; lng: number } | null,
  pos2: { lat: number; lng: number } | null,
  threshold = 0.5 // km
): boolean {
  if (!pos1 || !pos2) return true;

  const distance = calculateDistance(pos1.lat, pos1.lng, pos2.lat, pos2.lng);
  return distance > threshold;
}

// ==================== CURRENCY UTILITIES ====================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

export function parseCurrency(str: string): number {
  return parseFloat(str.replace(/[^0-9.-]+/g, ''));
}

// ==================== VALIDATION UTILITIES ====================

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePhone(phone: string): boolean {
  const re = /^[\d\s\-+()]+$/;
  return re.test(phone) && phone.replace(/\D/g, '').length >= 9;
}

export function validateCoordinates(lat?: number, lng?: number): boolean {
  if (!lat || !lng) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// ==================== ARRAY UTILITIES ====================

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = String(item[key]);
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

// ==================== STORAGE UTILITIES ====================

export async function checkStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
}> {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return {
      usage,
      quota,
      percentUsed: quota > 0 ? (usage / quota) * 100 : 0
    };
  }

  return { usage: 0, quota: 0, percentUsed: 0 };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ==================== DEVICE DETECTION ====================

export function isAndroidTablet(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /android/.test(ua) && !/mobile/.test(ua);
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

export function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function getDeviceInfo(): {
  type: 'desktop' | 'mobile' | 'tablet';
  os: 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'unknown';
} {
  const ua = navigator.userAgent;

  let type: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (isAndroidTablet() || /iPad/.test(ua)) {
    type = 'tablet';
  } else if (isMobile()) {
    type = 'mobile';
  }

  let os: 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'unknown' = 'unknown';
  if (isIOS()) os = 'ios';
  else if (isAndroid()) os = 'android';
  else if (/Windows/.test(ua)) os = 'windows';
  else if (/Mac/.test(ua)) os = 'mac';
  else if (/Linux/.test(ua)) os = 'linux';

  return { type, os };
}

// ==================== ERROR HANDLING ====================

export class DeliveryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DeliveryError';
  }
}

export function handleError(error: any): string {
  if (error instanceof DeliveryError) {
    return error.message;
  }

  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.message) {
    return error.message;
  }

  return 'Si è verificato un errore imprevisto';
}

// ==================== DEBOUNCE/THROTTLE ====================

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ==================== CLIPBOARD ====================

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

// ==================== VIBRATION ====================

export function vibrate(pattern: number | number[] = 200): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

export function vibrateSuccess(): void {
  vibrate([100, 50, 100]);
}

export function vibrateError(): void {
  vibrate([200, 100, 200, 100, 200]);
}

export function vibrateClick(): void {
  vibrate(50);
}
