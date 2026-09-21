import {
  getAllPostsFromStore,
  getPostBySlugFromStore,
  addSubscriber,
  getSubscribersList,
  handleTelegramWebhookUpdate,
  getGroupChatIds,
  getSystemStats,
  ensureTelegramDbInitialized,
} from "./src/server/telegramDb";
import { getObjectFromR2, getPresignedDownloadUrl } from "./src/server/r2";
import { SubscriberSchema, TelegramUpdateSchema } from "./src/server/validation";

interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_ID?: string;
  TELEGRAM_GROUP_ID?: string;
  CLOUDFLARE_R2_ACCOUNT_ID?: string;
  CLOUDFLARE_R2_BUCKET_NAME?: string;
  CLOUDFLARE_R2_ACCESS_KEY_ID?: string;
  CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string;
  APP_URL?: string;
  BLOG_STORE?: any;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Sync process.env for helper modules that rely on process.env
    if (env.CLOUDFLARE_R2_ACCOUNT_ID) process.env.CLOUDFLARE_R2_ACCOUNT_ID = env.CLOUDFLARE_R2_ACCOUNT_ID;
    if (env.CLOUDFLARE_R2_BUCKET_NAME) process.env.CLOUDFLARE_R2_BUCKET_NAME = env.CLOUDFLARE_R2_BUCKET_NAME;
    if (env.CLOUDFLARE_R2_ACCESS_KEY_ID) process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    if (env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    if (env.TELEGRAM_BOT_TOKEN) process.env.TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
    if (env.TELEGRAM_ADMIN_ID) process.env.TELEGRAM_ADMIN_ID = env.TELEGRAM_ADMIN_ID;
    if (env.TELEGRAM_GROUP_ID) process.env.TELEGRAM_GROUP_ID = env.TELEGRAM_GROUP_ID;
    if (env.APP_URL) process.env.APP_URL = env.APP_URL;

    try {
      await ensureTelegramDbInitialized(env.BLOG_STORE);
    } catch (e) {
      console.error("Initialization error:", e);
    }

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API Routes
    if (url.pathname.startsWith('/api/')) {
      try {
        // Health check
        if (url.pathname === '/api/health') {
          return new Response(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN),
            cloudflareConfigured: Boolean(env.CLOUDFLARE_R2_ACCOUNT_ID),
            resolvedGroupIds: getGroupChatIds(),
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // Stats
        if (url.pathname === '/api/stats') {
          return new Response(JSON.stringify(getSystemStats()), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // Posts
        if (url.pathname === '/api/posts') {
          const posts = getAllPostsFromStore();
          return new Response(JSON.stringify(posts), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (url.pathname.startsWith('/api/posts/')) {
          const slug = url.pathname.replace('/api/posts/', '');
          const post = getPostBySlugFromStore(slug);
          if (!post) {
            return new Response(JSON.stringify({ error: 'Post not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          return new Response(JSON.stringify(post), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // Media API
        if (url.pathname.startsWith('/api/media/')) {
          const key = url.pathname.replace('/api/media/', '');
          try {
            const signedUrl = await getPresignedDownloadUrl(key);
            return Response.redirect(signedUrl, 302);
          } catch (err: any) {
            try {
              const { body, contentType } = await getObjectFromR2(key);
              return new Response(body as any, {
                headers: {
                  'Content-Type': contentType || 'application/octet-stream',
                  'Cache-Control': 'public, max-age=2592000, immutable',
                  ...corsHeaders,
                },
              });
            } catch (innerErr) {
              return new Response('Media not found', { status: 404, headers: corsHeaders });
            }
          }
        }

        // Subscribers
        if (url.pathname === '/api/subscribers') {
          if (request.method === 'POST') {
            const body = await request.json();
            const validated = SubscriberSchema.parse(body);
            const sub = await addSubscriber(validated);
            return new Response(JSON.stringify(sub), {
              status: 201,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          } else {
            const subs = getSubscribersList();
            return new Response(JSON.stringify(subs), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
        }

        // Telegram Setup Webhook Endpoint
        if (url.pathname === '/api/telegram/setup-webhook') {
          const botToken = env.TELEGRAM_BOT_TOKEN;
          if (!botToken) {
            return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN secret is missing' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const webhookUrl = `${url.origin}/api/telegram/webhook`;
          const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
          const tgData = await tgRes.json();
          return new Response(JSON.stringify({ webhookUrl, tgResult: tgData }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // Telegram Webhook Handler
        if (url.pathname === '/api/telegram/webhook') {
          if (request.method === 'POST') {
            try {
              const update: any = await request.json();
              ctx.waitUntil(handleTelegramWebhookUpdate(update));
            } catch (err: any) {
              console.warn('Telegram webhook payload error:', err?.message || err);
            }
          }
          return new Response(JSON.stringify({ status: 'ok' }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // Dynamic Sitemap (/sitemap.xml, /sitemap)
    if (url.pathname === '/sitemap.xml' || url.pathname === '/sitemap') {
      const posts = getAllPostsFromStore();
      const baseUrl = env.APP_URL || url.origin;
      const today = new Date().toISOString().split('T')[0];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`;
      
      xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
      xml += `  <url>\n    <loc>${baseUrl}/about</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      xml += `  <url>\n    <loc>${baseUrl}/photography</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;

      const escapeXml = (unsafe: string) => unsafe ? unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;") : "";

      for (const p of posts) {
        if (p.isDeleted) continue;
        const postUrl = `${baseUrl}/post/${p.slug}`;
        const lastMod = (p.updatedAt || p.createdAt || p.date ? new Date(p.updatedAt || p.createdAt || p.date).toISOString() : new Date().toISOString()).split('T')[0];
        xml += `  <url>\n`;
        xml += `    <loc>${postUrl}</loc>\n`;
        xml += `    <lastmod>${lastMod}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.9</priority>\n`;
        if (p.coverImage) {
          const imgUrl = p.coverImage.startsWith('http') ? p.coverImage : `${baseUrl}${p.coverImage}`;
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${imgUrl}</image:loc>\n`;
          xml += `      <image:title>${escapeXml(p.title)}</image:title>\n`;
          xml += `    </image:image>\n`;
        }
        xml += `  </url>\n`;
      }
      xml += `</urlset>`;

      return new Response(xml, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8', ...corsHeaders },
      });
    }

    // Dynamic Robots.txt (/robots.txt)
    if (url.pathname === '/robots.txt') {
      const baseUrl = env.APP_URL || url.origin;
      let txt = `# Aluvantis Blog Robots.txt - Dynamic Cloudflare Worker Response\n`;
      txt += `User-agent: *\nAllow: /\nDisallow: /api/\nAllow: /api/posts\nAllow: /api/media/\n\n`;

      const aiAgents = [
        "GPTBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Claude-Web",
        "anthropic-ai", "Applebot", "Applebot-Extended", "Google-Extended",
        "Googlebot", "Meta-ExternalAgent", "cohere-ai", "Diffbot", "Bingbot", "YandexBot"
      ];
      for (const agent of aiAgents) {
        txt += `User-agent: ${agent}\nAllow: /\n\n`;
      }
      txt += `Sitemap: ${baseUrl}/sitemap.xml\n`;
      txt += `RSS: ${baseUrl}/feed.xml\n`;
      txt += `LLMs-Txt: ${baseUrl}/llms.txt\n`;

      return new Response(txt, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders },
      });
    }

    // Dynamic LLMs.txt (/llms.txt, /llm.txt, /llms)
    if (url.pathname === '/llms.txt' || url.pathname === '/llm.txt' || url.pathname === '/llms') {
      const posts = getAllPostsFromStore();
      const baseUrl = env.APP_URL || url.origin;

      let txt = `# Aluvantis Blog\n\n`;
      txt += `> Aluvantis korporativ tahlil va raqamli innovatsiyalar portali. CEO Anvar boshchiligida raqamli transformatsiya, IT arxitektura va zamonaviy biznes strategiyalari.\n\n`;
      txt += `## Asosiy Ma'lumotlar\n`;
      txt += `- Tashkilot: Aluvantis\n`;
      txt += `- Asoschi va CEO: Anvar\n`;
      txt += `- Veb-sayt: ${baseUrl}\n`;
      txt += `- RSS Tasmasi: ${baseUrl}/feed.xml\n`;
      txt += `- Sitemap: ${baseUrl}/sitemap.xml\n\n`;

      txt += `## Maqolalar va Ekspert Tahlillari\n\n`;
      for (const p of posts) {
        if (p.isDeleted) continue;
        const postUrl = `${baseUrl}/post/${p.slug}`;
        txt += `### [${p.title}](${postUrl})\n`;
        txt += `- **Sana**: ${p.date || p.createdAt}\n`;
        txt += `- **Muallif**: ${p.author?.name || "Anvar (CEO Aluvantis)"}\n`;
        txt += `- **Xulosa**: ${p.excerpt || (p.content || "").substring(0, 160)}\n\n`;
      }

      return new Response(txt, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders },
      });
    }

    // Dynamic RSS Feed (/feed.xml, /rss.xml)
    if (url.pathname === '/feed.xml' || url.pathname === '/rss.xml' || url.pathname === '/feed') {
      const posts = getAllPostsFromStore();
      const baseUrl = env.APP_URL || url.origin;
      let rss = `<?xml version="1.0" encoding="UTF-8" ?>\n`;
      rss += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n`;
      rss += `  <channel>\n`;
      rss += `    <title>Aluvantis — Biznes va Innovatsiyalar</title>\n`;
      rss += `    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml" />\n`;
      rss += `    <link>${baseUrl}</link>\n`;
      rss += `    <description>Aluvantis korporativ tahlil va raqamli innovatsiyalar portali.</description>\n`;
      rss += `    <language>uz</language>\n`;
      rss += `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;
      for (const p of posts) {
        rss += `    <item>\n`;
        rss += `      <title><![CDATA[${p.title}]]></title>\n`;
        rss += `      <link>${baseUrl}/post/${p.slug}</link>\n`;
        rss += `      <description><![CDATA[${p.excerpt}]]></description>\n`;
        rss += `      <pubDate>${new Date(p.createdAt || p.date).toUTCString()}</pubDate>\n`;
        rss += `      <guid>${baseUrl}/post/${p.slug}</guid>\n`;
        rss += `    </item>\n`;
      }
      rss += `  </channel>\n</rss>`;
      return new Response(rss, {
        headers: { 'Content-Type': 'application/xml', ...corsHeaders },
      });
    }

    // SPA Fallback: Serve dist assets or fallback to index.html for client side React router
    const hasExtension = url.pathname.split('/').pop()?.includes('.') || false;
    if (request.method === 'GET' && !url.pathname.startsWith('/api/') && !hasExtension) {
      const newUrl = new URL(request.url);
      newUrl.pathname = '/index.html';
      return env.ASSETS.fetch(new Request(newUrl.toString(), request));
    }

    return env.ASSETS.fetch(request);
  },
};
