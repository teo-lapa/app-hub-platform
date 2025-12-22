import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/blog/posts
 * Fetch all blog posts from Odoo
 */
export async function GET(request: NextRequest) {
  try {
    const odoo = await getOdooClient();

    // Fetch all blog posts (blog.post model in Odoo)
    const posts = await odoo.searchRead(
      'blog.post',
      [], // empty domain = fetch all
      [
        'id',
        'name',
        'subtitle',
        'content',
        'blog_id',
        'author_id',
        'website_published',
        'is_published',
        'create_date',
        'write_date',
        'website_meta_title',
        'website_meta_description',
        'website_meta_keywords',
        'cover_properties',
        'published_date'
      ],
      1000 // limit - fetch up to 1000 posts
    );

    console.log(`📝 Fetched ${posts.length} blog posts from Odoo`);

    // Transform to our BlogArticle format
    const articles = posts.map((post: any) => ({
      id: post.id,
      name: post.name || '',
      subtitle: post.subtitle || '',
      content_text: post.content ? stripHtml(post.content) : '',
      content_html: post.content || '',
      meta: {
        title: post.website_meta_title || post.name || '',
        description: post.website_meta_description || '',
        keywords: post.website_meta_keywords || ''
      },
      is_published: post.website_published || post.is_published || false,
      dates: {
        created: post.create_date || '',
        updated: post.write_date || ''
      },
      analysis: {
        wordCount: post.content ? countWords(stripHtml(post.content)) : 0,
        hasH1: post.content ? /<h1/i.test(post.content) : false,
        h1Count: post.content ? (post.content.match(/<h1/gi) || []).length : 0,
        hasH2: post.content ? /<h2/i.test(post.content) : false,
        h2Count: post.content ? (post.content.match(/<h2/gi) || []).length : 0,
        hasList: post.content ? /<ul|<ol/i.test(post.content) : false,
        hasImages: post.content ? (post.content.match(/<img/gi) || []).length : 0,
        imagesWithAlt: post.content ? (post.content.match(/<img[^>]+alt=/gi) || []).length : 0,
        titleLength: (post.website_meta_title || post.name || '').length,
        descriptionLength: (post.website_meta_description || '').length,
        hasMeta: !!(post.website_meta_title || post.website_meta_description || post.website_meta_keywords)
      }
    }));

    return NextResponse.json({
      success: true,
      articles,
      total: articles.length,
      summary: {
        totalArticles: articles.length,
        publishedArticles: articles.filter((a: any) => a.is_published).length,
        articlesWithMeta: articles.filter((a: any) => a.analysis.hasMeta).length
      }
    });

  } catch (error: any) {
    console.error('❌ Error fetching blog posts:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch blog posts',
      articles: [],
      total: 0
    }, { status: 500 });
  }
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}
