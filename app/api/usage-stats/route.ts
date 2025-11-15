import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const runtime = 'edge';

interface UsageStats {
  totalEvents: number;
  totalApps: number;
  totalUsers: number;
  appStats: Array<{
    appId: string;
    appName: string;
    openCount: number;
    uniqueUsers: number;
    totalDuration: number; // in secondi
    avgDuration: number; // in secondi
  }>;
  userStats: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    totalSessions: number;
    appsUsed: string[];
  }>;
  timeline: Array<{
    date: string;
    openCount: number;
    uniqueUsers: number;
  }>;
  recentSessions: Array<{
    userId: string;
    userName: string;
    appId: string;
    appName: string;
    timestamp: number;
    action: string;
    duration?: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const appId = searchParams.get('appId'); // Filtro per app specifica

    // Genera array di date per il periodo richiesto
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Recupera tutti gli eventi per le date richieste
    const allEvents: any[] = [];
    const appStatsMap = new Map<string, any>();
    const userStatsMap = new Map<string, any>();
    const timelineMap = new Map<string, { openCount: number; usersSet: Set<string> }>();

    for (const date of dates) {
      // Recupera tutte le chiavi per questa data
      const pattern = `usage:${date}:*`;
      const keys = await kv.keys(pattern);

      if (keys.length > 0) {
        // Recupera eventi in batch (max 100 per volta per performance)
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          const events = await kv.mget(...batch);

          events.forEach((event: any, idx) => {
            if (!event) return;

            // Filtro per appId se specificato
            if (appId && event.appId !== appId) return;

            allEvents.push(event);

            // Statistiche per app
            if (!appStatsMap.has(event.appId)) {
              appStatsMap.set(event.appId, {
                appId: event.appId,
                appName: event.appName,
                openCount: 0,
                usersSet: new Set<string>(),
                totalDuration: 0,
                sessionCount: 0,
              });
            }
            const appStat = appStatsMap.get(event.appId);
            if (event.action === 'open') {
              appStat.openCount++;
              appStat.usersSet.add(event.userId);
            }
            if (event.action === 'close' && event.duration) {
              appStat.totalDuration += event.duration;
              appStat.sessionCount++;
            }

            // Statistiche per utente
            if (!userStatsMap.has(event.userId)) {
              userStatsMap.set(event.userId, {
                userId: event.userId,
                userName: event.userName,
                userEmail: event.userEmail,
                totalSessions: 0,
                appsSet: new Set<string>(),
              });
            }
            const userStat = userStatsMap.get(event.userId);
            if (event.action === 'open') {
              userStat.totalSessions++;
              userStat.appsSet.add(event.appId);
            }

            // Timeline
            if (!timelineMap.has(date)) {
              timelineMap.set(date, { openCount: 0, usersSet: new Set<string>() });
            }
            const timeline = timelineMap.get(date)!;
            if (event.action === 'open') {
              timeline.openCount++;
              timeline.usersSet.add(event.userId);
            }
          });
        }
      }
    }

    // Converti Map in Array per risposta
    const appStats = Array.from(appStatsMap.values()).map(stat => ({
      appId: stat.appId,
      appName: stat.appName,
      openCount: stat.openCount,
      uniqueUsers: stat.usersSet.size,
      totalDuration: Math.round(stat.totalDuration / 1000), // ms -> secondi
      avgDuration: stat.sessionCount > 0
        ? Math.round(stat.totalDuration / stat.sessionCount / 1000)
        : 0,
    })).sort((a, b) => b.openCount - a.openCount);

    const userStats = Array.from(userStatsMap.values()).map(stat => ({
      userId: stat.userId,
      userName: stat.userName,
      userEmail: stat.userEmail,
      totalSessions: stat.totalSessions,
      appsUsed: Array.from(stat.appsSet),
    })).sort((a, b) => b.totalSessions - a.totalSessions);

    const timeline = Array.from(timelineMap.entries())
      .map(([date, data]) => ({
        date,
        openCount: data.openCount,
        uniqueUsers: data.usersSet.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Sessioni recenti (ultime 20)
    const recentSessions = allEvents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
      .map(event => ({
        userId: event.userId,
        userName: event.userName,
        appId: event.appId,
        appName: event.appName,
        timestamp: event.timestamp,
        action: event.action,
        duration: event.duration ? Math.round(event.duration / 1000) : undefined,
      }));

    const stats: UsageStats = {
      totalEvents: allEvents.length,
      totalApps: appStatsMap.size,
      totalUsers: userStatsMap.size,
      appStats,
      userStats,
      timeline,
      recentSessions,
    };

    return NextResponse.json({
      success: true,
      data: stats,
      period: { days, from: dates[dates.length - 1], to: dates[0] },
    });

  } catch (error) {
    console.error('[USAGE-STATS] Errore:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nel recupero statistiche'
    }, { status: 500 });
  }
}
