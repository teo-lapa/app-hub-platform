'use client';

import { useEffect, useState } from 'react';

interface OfflineCacheOptions<T> {
  key: string;
  data?: T;
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function useOfflineCache<T>({
  key,
  data,
  ttl = 5 * 60 * 1000 // 5 minutes default
}: OfflineCacheOptions<T>) {
  const [cachedData, setCachedData] = useState<T | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Load from cache on mount
  useEffect(() => {
    const loadFromCache = () => {
      try {
        const cached = localStorage.getItem(`maestro-cache-${key}`);
        if (cached) {
          const entry: CacheEntry<T> = JSON.parse(cached);
          const age = Date.now() - entry.timestamp;

          if (age < ttl) {
            setCachedData(entry.data);
            setIsStale(false);
          } else {
            // Cache expired
            setIsStale(true);
            localStorage.removeItem(`maestro-cache-${key}`);
          }
        }
      } catch (error) {
        console.error('Error loading from cache:', error);
        localStorage.removeItem(`maestro-cache-${key}`);
      }
    };

    loadFromCache();
  }, [key, ttl]);

  // Save to cache when data changes
  useEffect(() => {
    if (data !== undefined) {
      try {
        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now()
        };
        localStorage.setItem(`maestro-cache-${key}`, JSON.stringify(entry));
        setCachedData(data);
        setIsStale(false);
      } catch (error) {
        console.error('Error saving to cache:', error);
        // Handle quota exceeded
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          clearOldCache();
        }
      }
    }
  }, [data, key]);

  const clearCache = () => {
    localStorage.removeItem(`maestro-cache-${key}`);
    setCachedData(null);
  };

  const clearOldCache = () => {
    // Remove all maestro cache items older than TTL
    const keys = Object.keys(localStorage);
    const maestroKeys = keys.filter(k => k.startsWith('maestro-cache-'));

    maestroKeys.forEach(k => {
      try {
        const cached = localStorage.getItem(k);
        if (cached) {
          const entry = JSON.parse(cached);
          const age = Date.now() - entry.timestamp;
          if (age > ttl) {
            localStorage.removeItem(k);
          }
        }
      } catch {
        localStorage.removeItem(k);
      }
    });
  };

  return {
    cachedData: data || cachedData,
    isStale,
    clearCache
  };
}
