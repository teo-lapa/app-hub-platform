import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

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

    const odoo = await getOdooClient();

    // Extract mimetype and clean base64
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    const mimetype = mimeMatch ? mimeMatch[1] : 'image/png';
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const imageFilename = filename || `blog_post_${blogPostId}_${Date.now()}.png`;

    console.log(`📤 Uploading image to blog post ${blogPostId}...`);

    // Upload image as ir.attachment
    const attachmentIds = await odoo.create('ir.attachment', [{
      name: imageFilename,
      type: 'binary',
      datas: cleanBase64,
      mimetype: mimetype,
      public: true,
      res_model: 'blog.post',
      res_id: blogPostId
    }]);

    if (!attachmentIds || attachmentIds.length === 0) {
      throw new Error('Failed to create attachment');
    }

    const attachmentId = attachmentIds[0];

    console.log(`✅ Image uploaded as attachment ${attachmentId}`);

    // Update blog post to use this image
    // In Odoo, blog.post uses 'cover_properties' field for the cover image
    // We need to update the blog post with the image
    const updateSuccess = await odoo.write('blog.post', [blogPostId], {
      cover_properties: JSON.stringify({
        background_image: `/web/image/${attachmentId}`,
        resize_class: 'cover',
        opacity: '0.4'
      })
    });

    if (!updateSuccess) {
      throw new Error('Failed to update blog post with image');
    }

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
