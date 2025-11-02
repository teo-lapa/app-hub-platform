import { NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

export async function GET() {
  try {
    console.log('🔍 Testing Odoo image fields...');

    // Fetch 5 products with all image fields
    const products = await callOdooAsAdmin(
      'product.product',
      'search_read',
      [],
      {
        domain: [['sale_ok', '=', true]],
        fields: ['id', 'name', 'image_1920', 'image_512', 'image_256', 'image_128'],
        limit: 5,
      }
    );

    const results = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      images: {
        image_1920: p.image_1920 ? `${Math.round(p.image_1920.length / 1024)} KB` : 'NO',
        image_512: p.image_512 ? `${Math.round(p.image_512.length / 1024)} KB` : 'NO',
        image_256: p.image_256 ? `${Math.round(p.image_256.length / 1024)} KB` : 'NO',
        image_128: p.image_128 ? `${Math.round(p.image_128.length / 1024)} KB` : 'NO',
      }
    }));

    const summary = {
      total: products.length,
      with_1920: products.filter((p: any) => p.image_1920).length,
      with_512: products.filter((p: any) => p.image_512).length,
      with_256: products.filter((p: any) => p.image_256).length,
      with_128: products.filter((p: any) => p.image_128).length,
    };

    return NextResponse.json({
      summary,
      products: results
    });

  } catch (error: any) {
    console.error('Error testing images:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
