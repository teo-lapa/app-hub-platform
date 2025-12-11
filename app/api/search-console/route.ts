import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Service Account credentials from environment variables
const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: process.env.GSC_PROJECT_ID,
  private_key_id: process.env.GSC_PRIVATE_KEY_ID,
  private_key: process.env.GSC_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.GSC_CLIENT_EMAIL,
  client_id: process.env.GSC_CLIENT_ID,
};

const SITE_URL = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || 'https://www.lapa.ch/';

async function getSearchConsoleClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: SERVICE_ACCOUNT,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });
  return searchconsole;
}

export async function GET() {
  try {
    const searchconsole = await getSearchConsoleClient();

    // Get last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Get search analytics data
    const response = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['date'],
        rowLimit: 10,
      },
    });

    // Get query data (top search terms)
    const queryResponse = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['query'],
        rowLimit: 10,
      },
    });

    // Get page data
    const pageResponse = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['page'],
        rowLimit: 10,
      },
    });

    // Get country data
    const countryResponse = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['country'],
        rowLimit: 10,
      },
    });

    // Process daily data
    const dailyData = (response.data.rows || []).map((row: any) => ({
      date: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: (row.ctr * 100).toFixed(2),
      position: row.position.toFixed(1),
    }));

    // Calculate totals
    const totals = dailyData.reduce(
      (acc: any, day: any) => ({
        clicks: acc.clicks + day.clicks,
        impressions: acc.impressions + day.impressions,
      }),
      { clicks: 0, impressions: 0 }
    );

    // Top queries
    const topQueries = (queryResponse.data.rows || []).slice(0, 5).map((row: any) => ({
      query: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: (row.ctr * 100).toFixed(1),
      position: row.position.toFixed(1),
    }));

    // Top pages
    const topPages = (pageResponse.data.rows || []).slice(0, 5).map((row: any) => ({
      page: row.keys[0].replace(SITE_URL, '/'),
      clicks: row.clicks,
      impressions: row.impressions,
    }));

    // Top countries
    const topCountries = (countryResponse.data.rows || []).slice(0, 5).map((row: any) => ({
      country: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
    }));

    // Calculate growth (compare last 3 days vs previous 3 days)
    const last3Days = dailyData.slice(-3).reduce((sum: number, d: any) => sum + d.clicks, 0);
    const prev3Days = dailyData.slice(0, 3).reduce((sum: number, d: any) => sum + d.clicks, 0);
    const growth = prev3Days > 0 ? (((last3Days - prev3Days) / prev3Days) * 100).toFixed(1) : '0';

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalClicks: totals.clicks,
          totalImpressions: totals.impressions,
          avgCTR: totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '0',
          avgPosition: dailyData.length > 0
            ? (dailyData.reduce((sum: number, d: any) => sum + parseFloat(d.position), 0) / dailyData.length).toFixed(1)
            : '0',
          growth: parseFloat(growth),
        },
        dailyData,
        topQueries,
        topPages,
        topCountries,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Search Console API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch Search Console data',
      },
      { status: 500 }
    );
  }
}
