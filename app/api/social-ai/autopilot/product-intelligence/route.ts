import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/social-ai/autopilot/product-intelligence
 *
 * Fetches product intelligence for the autopilot:
 * - Products from Odoo catalog
 * - Cross-references with social_posts to find unposted products
 * - Returns scored/ranked products for autopilot suggestions
 */
export async function GET(request: NextRequest) {
  try {
    // Check if caller wants all products (for product picker) or just top picks (for autopilot)
    const returnAll = request.nextUrl.searchParams.get('all') === 'true';
    const limit = returnAll ? 500 : 100;

    // Fetch products from the internal API
    const productsResponse = await fetch(
      `${request.nextUrl.origin}/api/portale-clienti/products?limit=${limit}`,
      { headers: { cookie: request.headers.get('cookie') || '' } }
    );

    if (!productsResponse.ok) {
      return NextResponse.json(
        { error: 'Impossibile caricare prodotti dal catalogo' },
        { status: 500 }
      );
    }

    const productsData = await productsResponse.json();
    const products = productsData.products || productsData.data?.products || [];

    if (products.length === 0) {
      return NextResponse.json({
        success: true,
        data: { products: [], stats: { total: 0, neverPosted: 0, recentlyPosted: 0 } }
      });
    }

    // Get recently posted product names (last 30 days)
    let recentlyPostedNames: string[] = [];
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentPosts = await sql`
        SELECT DISTINCT product_name
        FROM social_posts
        WHERE created_at >= ${thirtyDaysAgo.toISOString()}
        AND product_name IS NOT NULL
        AND product_name != ''
      `;
      recentlyPostedNames = recentPosts.rows.map(r => r.product_name?.toLowerCase() || '');
    } catch {
      // DB might not have social_posts table yet, continue
    }

    // Score each product
    const scoredProducts = products.map((product: any) => {
      const name = product.name || product.display_name || '';
      const wasRecentlyPosted = recentlyPostedNames.some(
        posted => name.toLowerCase().includes(posted) || posted.includes(name.toLowerCase())
      );

      // The products API returns image as "data:image/jpeg;base64,..." already
      const productImage = product.image || product.image_1920 || product.image_512 || null;

      let score = 50; // base score
      if (!wasRecentlyPosted) score += 30; // bonus for never posted
      if (productImage) score += 10; // has image
      if (product.list_price > 10 || product.price > 10) score += 10; // higher value products

      // Extract category name from various formats (object {id,name}, array [id,name], or string)
      const rawCategory = product.categ_id?.[1] || product.categ_name || product.category;
      const categoryName = typeof rawCategory === 'object' && rawCategory !== null
        ? (rawCategory.name || rawCategory[1] || 'Food')
        : (rawCategory || 'Food');

      return {
        id: product.id,
        name,
        code: product.default_code || product.code || '',
        category: String(categoryName),
        price: product.list_price || product.price || 0,
        image: productImage,
        hasImage: !!productImage,
        wasRecentlyPosted,
        score,
      };
    });

    // Sort by score (highest first)
    scoredProducts.sort((a: any, b: any) => b.score - a.score);

    const stats = {
      total: scoredProducts.length,
      neverPosted: scoredProducts.filter((p: any) => !p.wasRecentlyPosted).length,
      recentlyPosted: scoredProducts.filter((p: any) => p.wasRecentlyPosted).length,
      withImage: scoredProducts.filter((p: any) => p.hasImage).length,
    };

    // For product picker: return all products; for autopilot: top 50
    const outputProducts = returnAll ? scoredProducts : scoredProducts.slice(0, 50);

    return NextResponse.json({
      success: true,
      data: { products: outputProducts, stats }
    });

  } catch (error: any) {
    console.error('[ProductIntelligence] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore durante analisi prodotti' },
      { status: 500 }
    );
  }
}
