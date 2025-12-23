import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/blog/upload-image
 * Upload a generated image to an Odoo blog post
 *
 * Body:
 * - blogPostId: number - ID of the blog post in Odoo
 * - imageBase64: string - Base64 encoded image (with data:image prefix)
 * - filename?: string - Optional filename
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { blogPostId, imageBase64, filename } = body;

    if (!blogPostId || !imageBase64) {
      return NextResponse.json({
        success: false,
        error: 'Missing blogPostId or imageBase64'
      }, { status: 400 });
    }

    // Get user session (same as publish-recipe)
    const userCookies = request.headers.get('cookie');
    if (!userCookies) {
      return NextResponse.json({
        success: false,
        error: 'User not logged in'
      }, { status: 401 });
    }

    const { cookies: odooCookies, uid } = await getOdooSession(userCookies);
    if (!odooCookies) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Odoo session'
      }, { status: 401 });
    }

    // Extract mimetype and clean base64
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    const mimetype = mimeMatch ? mimeMatch[1] : 'image/png';
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const imageFilename = filename || `blog_post_${blogPostId}_${Date.now()}.png`;

    console.log(`📤 Uploading image to blog post ${blogPostId}...`);

    // Upload image as ir.attachment (same as publish-recipe)
    console.log(`📤 Creating attachment for blog post ${blogPostId}...`);
    const attachmentId = await callOdoo(
      odooCookies,
      'ir.attachment',
      'create',
      [{
        name: imageFilename,
        type: 'binary',
        datas: cleanBase64,
        mimetype: mimetype,
        public: true,
        res_model: 'blog.post',
        res_id: blogPostId
      }]
    );

    if (!attachmentId) {
      throw new Error('Failed to create attachment');
    }

    console.log(`✅ Image uploaded as attachment ${attachmentId}`);

    // Update blog post to use this image
    // In Odoo, blog.post uses 'cover_properties' field for the cover image
    // We need to update the blog post with the image
    console.log(`📝 Updating blog post ${blogPostId} with cover image...`);

    // Set cover_properties - EXACT format from publish-recipe (working code)
    const coverProperties = {
      'background-image': `url(/web/image/${attachmentId})`, // NO quotes inside url()!
      'background_color_class': 'o_cc3 o_cc',
      'background_color_style': '',
      'opacity': '0.2',
      'resize_class': 'o_half_screen_height o_record_has_cover',
      'text_align_class': ''
    };

    console.log(`📝 Cover properties:`, coverProperties);

    // Update blog post with callOdoo (same as publish-recipe)
    await callOdoo(
      odooCookies,
      'blog.post',
      'write',
      [[blogPostId], {
        cover_properties: JSON.stringify(coverProperties)
      }]
    );

    console.log(`✅ Blog post ${blogPostId} updated with cover image`);

    return NextResponse.json({
      success: true,
      attachmentId,
      blogPostId,
      message: 'Image uploaded successfully to Odoo blog post'
    });

  } catch (error: any) {
    console.error('❌ Error uploading image to blog post:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to upload image'
    }, { status: 500 });
  }
}
