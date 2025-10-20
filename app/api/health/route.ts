import { NextRequest, NextResponse } from 'next/server';

/**
 * Health Check Endpoint - Enhanced for Production Monitoring
 *
 * Used by:
 * - UptimeRobot (uptime monitoring)
 * - Cloudflare Load Balancer (failover detection)
 * - Internal monitoring dashboards
 *
 * Returns:
 * - 200: System healthy
 * - 503: System degraded/unhealthy
 */

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const startTime = Date.now();

export async function GET(req: NextRequest) {
  try {
    const region = process.env.VERCEL_REGION || 'unknown';
    const version = process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'dev';
    const env = process.env.NODE_ENV || 'development';

    // System checks
    const checks = {
      api: true,
      timestamp: Date.now(),
      memory: process.memoryUsage ? process.memoryUsage().heapUsed / 1024 / 1024 : 0
    };

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      region,
      version,
      environment: env,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      checks
    };

    return NextResponse.json(health, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'v2',
        'X-Region': region
      }
    });

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 503
    });
  }
}

export async function HEAD(req: NextRequest) {
  return new NextResponse(null, { status: 200 });
}