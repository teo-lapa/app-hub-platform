import { NextResponse } from 'next/server';

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

// Paesi reali (clienti potenziali)
const REAL_COUNTRIES = ['Switzerland', 'Italy', 'France', 'Germany', 'Austria', 'Liechtenstein'];

async function authenticate(): Promise<string> {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: { db: ODOO_DB, login: ODOO_LOGIN, password: ODOO_PASSWORD }
    })
  });

  const data = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');

  const cookies = response.headers.get('set-cookie');
  const sessionMatch = cookies?.match(/session_id=([^;]+)/);
  return `session_id=${sessionMatch?.[1]}`;
}

async function callOdoo(cookie: string, model: string, method: string, args: any[], kwargs: any = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.data?.message || 'Odoo error');
  return data.result;
}

export async function GET() {
  try {
    const cookie = await authenticate();

    // Get real country IDs
    const countries = await callOdoo(cookie, 'res.country', 'search_read',
      [[['name', 'in', REAL_COUNTRIES]]],
      { fields: ['id', 'name'] }
    );
    const realCountryIds = countries.map((c: any) => c.id);

    // Generate last 7 days
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }

    // Get visitors per day (real countries only)
    const visitorsPerDay: { date: string; count: number }[] = [];
    for (const day of days) {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];

      const count = await callOdoo(cookie, 'website.visitor', 'search_count',
        [[
          ['last_connection_datetime', '>=', day],
          ['last_connection_datetime', '<', nextDayStr],
          ['country_id', 'in', realCountryIds]
        ]]
      );
      visitorsPerDay.push({ date: day, count });
    }

    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = days[0];

    // Get total visitors this week (real countries)
    const totalVisitors = await callOdoo(cookie, 'website.visitor', 'search_count',
      [[
        ['last_connection_datetime', '>=', sevenDaysAgo],
        ['country_id', 'in', realCountryIds]
      ]]
    );

    // Get visitor details for breakdown
    const visitors = await callOdoo(cookie, 'website.visitor', 'search_read',
      [[
        ['last_connection_datetime', '>=', sevenDaysAgo],
        ['country_id', 'in', realCountryIds]
      ]],
      { fields: ['visit_count', 'visitor_page_count', 'country_id', 'lang_id', 'last_visited_page_id'], limit: 1000 }
    );

    // Aggregate stats
    let totalPageViews = 0;
    const countriesCount: Record<string, number> = {};
    const languagesCount: Record<string, number> = {};
    const pagesCount: Record<string, number> = {};

    visitors.forEach((v: any) => {
      totalPageViews += v.visitor_page_count || 0;

      const country = v.country_id ? v.country_id[1] : 'Sconosciuto';
      countriesCount[country] = (countriesCount[country] || 0) + 1;

      const lang = v.lang_id ? v.lang_id[1] : 'Sconosciuto';
      languagesCount[lang] = (languagesCount[lang] || 0) + 1;

      if (v.last_visited_page_id) {
        const page = v.last_visited_page_id[1];
        pagesCount[page] = (pagesCount[page] || 0) + 1;
      }
    });

    // Sort and get top items
    const topCountries = Object.entries(countriesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count, percentage: ((count / totalVisitors) * 100).toFixed(1) }));

    const topLanguages = Object.entries(languagesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => ({ name, count, percentage: ((count / totalVisitors) * 100).toFixed(1) }));

    const topPages = Object.entries(pagesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Calculate growth (compare last 3 days vs previous 3 days)
    const last3Days = visitorsPerDay.slice(-3).reduce((sum, d) => sum + d.count, 0);
    const prev3Days = visitorsPerDay.slice(0, 3).reduce((sum, d) => sum + d.count, 0);
    const growth = prev3Days > 0 ? (((last3Days - prev3Days) / prev3Days) * 100).toFixed(1) : '0';

    // Today vs yesterday
    const todayCount = visitorsPerDay[visitorsPerDay.length - 1]?.count || 0;
    const yesterdayCount = visitorsPerDay[visitorsPerDay.length - 2]?.count || 0;
    const dailyGrowth = yesterdayCount > 0 ? (((todayCount - yesterdayCount) / yesterdayCount) * 100).toFixed(1) : '0';

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalVisitors,
          totalPageViews,
          avgPagesPerVisitor: totalVisitors > 0 ? (totalPageViews / totalVisitors).toFixed(1) : '0',
          todayVisitors: todayCount,
          growth: parseFloat(growth),
          dailyGrowth: parseFloat(dailyGrowth)
        },
        visitorsPerDay,
        topCountries,
        topLanguages,
        topPages,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Website Analytics Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
