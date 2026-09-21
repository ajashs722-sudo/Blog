import fs from "fs";
import path from "path";
import { articles, defaultAuthor } from "../src/data/articles";

const siteUrl = "https://blog.aluvantis.uz";
const today = new Date().toISOString().split("T")[0];

function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeIsoDate(dStr?: string): string {
  if (dStr) {
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function safeUtcDate(dStr?: string): string {
  if (dStr) {
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) return d.toUTCString();
  }
  return new Date().toUTCString();
}

function loadPostsFromDisk(): any[] {
  const dataPath = path.resolve(process.cwd(), "data_posts.json");
  if (fs.existsSync(dataPath)) {
    try {
      const raw = fs.readFileSync(dataPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.posts) && parsed.posts.length > 0) {
        return parsed.posts.filter((p: any) => !p.isDeleted);
      }
    } catch (e) {
      console.warn("Could not parse data_posts.json, using fallback articles");
    }
  }
  return articles;
}

export function generateSeoFiles() {
  console.log("Generating static SEO files (sitemap.xml, robots.txt, feed.xml, rss.xml, llms.txt, _redirects, vercel.json)...");

  const posts = loadPostsFromDisk();

  // 1. Generate Sitemap XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset \n`;
  xml += `  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n`;
  xml += `  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`;

  // Home Page
  xml += `  <url>\n`;
  xml += `    <loc>${siteUrl}/</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>1.0</priority>\n`;
  xml += `    <image:image>\n`;
  xml += `      <image:loc>${siteUrl}/logo.png</image:loc>\n`;
  xml += `      <image:title>Aluvantis Logotip</image:title>\n`;
  xml += `      <image:caption>Aluvantis korporativ tahlil va raqamli innovatsiyalar portali</image:caption>\n`;
  xml += `    </image:image>\n`;
  for (const p of posts.slice(0, 6)) {
    if (p.coverImage) {
      const pImg = p.coverImage.startsWith("http") ? p.coverImage : `${siteUrl}${p.coverImage}`;
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${pImg}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(p.title)}</image:title>\n`;
      xml += `      <image:caption>${escapeXml(p.excerpt)}</image:caption>\n`;
      xml += `    </image:image>\n`;
    }
  }
  xml += `  </url>\n`;

  // About Page (CEO Anvar)
  const authorImg = defaultAuthor.avatar.startsWith("http") ? defaultAuthor.avatar : `${siteUrl}${defaultAuthor.avatar}`;
  xml += `  <url>\n`;
  xml += `    <loc>${siteUrl}/about</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>monthly</changefreq>\n`;
  xml += `    <priority>0.8</priority>\n`;
  xml += `    <image:image>\n`;
  xml += `      <image:loc>${authorImg}</image:loc>\n`;
  xml += `      <image:title>Anvar — CEO Aluvantis</image:title>\n`;
  xml += `      <image:caption>Aluvantis kompaniyasi asoschisi va bosh direktori (CEO) Anvar</image:caption>\n`;
  xml += `    </image:image>\n`;
  xml += `  </url>\n`;

  // Photography Page
  xml += `  <url>\n`;
  xml += `    <loc>${siteUrl}/photography</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>0.9</priority>\n`;
  for (const p of posts) {
    if (p.coverImage) {
      const cImg = p.coverImage.startsWith("http") ? p.coverImage : `${siteUrl}${p.coverImage}`;
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${cImg}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(p.title)}</image:title>\n`;
      xml += `      <image:caption>${escapeXml(p.excerpt)}</image:caption>\n`;
      xml += `    </image:image>\n`;
    }
    if (p.mediaGallery && p.mediaGallery.length > 0) {
      for (const g of p.mediaGallery) {
        const gImg = g.startsWith("http") ? g : `${siteUrl}${g}`;
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${gImg}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(p.title)} — Galereya</image:title>\n`;
        xml += `    </image:image>\n`;
      }
    }
  }
  xml += `  </url>\n`;

  // Individual Posts
  for (const post of posts) {
    const postUrl = `${siteUrl}/post/${post.slug}`;
    const postLastMod = safeIsoDate(post.updatedAt || post.createdAt || post.date).split("T")[0];
    const imgUrl = post.coverImage.startsWith("http") ? post.coverImage : `${siteUrl}${post.coverImage}`;

    xml += `  <url>\n`;
    xml += `    <loc>${postUrl}</loc>\n`;
    xml += `    <lastmod>${postLastMod}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.9</priority>\n`;

    if (post.coverImage) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${imgUrl}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(post.title)}</image:title>\n`;
      xml += `      <image:caption>${escapeXml(post.excerpt)}</image:caption>\n`;
      xml += `    </image:image>\n`;
    }

    if (post.mediaGallery && post.mediaGallery.length > 0) {
      for (const g of post.mediaGallery) {
        const gImg = g.startsWith("http") ? g : `${siteUrl}${g}`;
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${gImg}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(post.title)} — Foto</image:title>\n`;
        xml += `    </image:image>\n`;
      }
    }

    if (post.youtubeUrl || post.videoUrl) {
      const videoLoc = post.videoUrl || post.youtubeUrl;
      xml += `    <video:video>\n`;
      xml += `      <video:thumbnail_loc>${imgUrl}</video:thumbnail_loc>\n`;
      xml += `      <video:title>${escapeXml(post.title)}</video:title>\n`;
      xml += `      <video:description>${escapeXml(post.excerpt)}</video:description>\n`;
      xml += `      <video:content_loc>${escapeXml(videoLoc)}</video:content_loc>\n`;
      if (post.youtubeUrl) {
        xml += `      <video:player_loc>${escapeXml(post.youtubeUrl)}</video:player_loc>\n`;
      }
      xml += `      <video:publication_date>${safeIsoDate(post.date || post.createdAt)}</video:publication_date>\n`;
      xml += `      <video:family_friendly>yes</video:family_friendly>\n`;
      xml += `    </video:video>\n`;
    }

    xml += `  </url>\n`;
  }

  xml += `</urlset>`;

  // 2. Generate Robots.txt
  let robotsText = `# Aluvantis Blog Robots.txt - 2026 AI, GEO & Search Engine Optimization\n`;
  robotsText += `User-agent: *\n`;
  robotsText += `Allow: /\n`;
  robotsText += `Disallow: /api/\n`;
  robotsText += `Allow: /api/posts\n`;
  robotsText += `Allow: /api/media/\n\n`;

  const aiAgents = [
    "GPTBot",
    "ChatGPT-User",
    "PerplexityBot",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "Applebot",
    "Applebot-Extended",
    "Google-Extended",
    "Googlebot",
    "Meta-ExternalAgent",
    "cohere-ai",
    "Diffbot",
    "Bingbot",
    "YandexBot"
  ];

  for (const agent of aiAgents) {
    robotsText += `User-agent: ${agent}\nAllow: /\n\n`;
  }

  robotsText += `# Discovery Endpoints\n`;
  robotsText += `Sitemap: ${siteUrl}/sitemap.xml\n`;
  robotsText += `RSS: ${siteUrl}/feed.xml\n`;
  robotsText += `LLMs-Txt: ${siteUrl}/llms.txt\n`;

  // 3. Generate RSS Feed XML
  let rss = `<?xml version="1.0" encoding="UTF-8" ?>\n`;
  rss += `<rss version="2.0" \n`;
  rss += `  xmlns:content="http://purl.org/rss/1.0/modules/content/"\n`;
  rss += `  xmlns:wfw="http://wellformedweb.org/CommentAPI/"\n`;
  rss += `  xmlns:dc="http://purl.org/dc/elements/1.1/"\n`;
  rss += `  xmlns:atom="http://www.w3.org/2005/Atom"\n`;
  rss += `  xmlns:sy="http://purl.org/rss/1.0/modules/syndication/"\n`;
  rss += `  xmlns:slash="http://purl.org/rss/1.0/modules/slash/"\n`;
  rss += `  xmlns:media="http://search.yahoo.com/mrss/"\n`;
  rss += `>\n`;
  rss += `  <channel>\n`;
  rss += `    <title>Aluvantis — Biznes va Innovatsiyalar</title>\n`;
  rss += `    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />\n`;
  rss += `    <link>${siteUrl}</link>\n`;
  rss += `    <description>Aluvantis korporativ tahlil va raqamli innovatsiyalar portali. CEO Anvar boshchiligida raqamli transformatsiya va biznes strategiyalari.</description>\n`;
  rss += `    <language>uz</language>\n`;
  rss += `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;
  rss += `    <sy:updatePeriod>hourly</sy:updatePeriod>\n`;
  rss += `    <sy:updateFrequency>1</sy:updateFrequency>\n`;
  rss += `    <image>\n`;
  rss += `      <url>${siteUrl}/logo.png</url>\n`;
  rss += `      <title>Aluvantis</title>\n`;
  rss += `      <link>${siteUrl}</link>\n`;
  rss += `      <width>512</width>\n`;
  rss += `      <height>512</height>\n`;
  rss += `    </image>\n`;

  for (const post of posts) {
    const postUrl = `${siteUrl}/post/${post.slug}`;
    const imgUrl = post.coverImage.startsWith("http") ? post.coverImage : `${siteUrl}${post.coverImage}`;

    let formattedContent = "";
    if (post.coverImage) {
      formattedContent += `<p><img src="${imgUrl}" alt="${escapeXml(post.title)}" /></p>\n`;
    }
    const paragraphs = (post.content || "")
      .split(/\n\n+/)
      .map((p: string) => `<p>${escapeXml(p.trim())}</p>`)
      .join("\n");
    formattedContent += paragraphs;

    rss += `    <item>\n`;
    rss += `      <title><![CDATA[${post.title}]]></title>\n`;
    rss += `      <link>${postUrl}</link>\n`;
    rss += `      <guid isPermaLink="true">${postUrl}</guid>\n`;
    rss += `      <pubDate>${safeUtcDate(post.date || post.createdAt)}</pubDate>\n`;
    rss += `      <dc:creator><![CDATA[${post.author?.name || "Anvar (CEO Aluvantis)"}]]></dc:creator>\n`;
    rss += `      <description><![CDATA[${post.excerpt}]]></description>\n`;
    rss += `      <content:encoded><![CDATA[${formattedContent}]]></content:encoded>\n`;
    if (post.coverImage) {
      rss += `      <enclosure url="${imgUrl}" length="0" type="image/jpeg" />\n`;
      rss += `      <media:content url="${imgUrl}" medium="image" type="image/jpeg" />\n`;
    }
    rss += `    </item>\n`;
  }

  rss += `  </channel>\n`;
  rss += `</rss>`;

  // 4. Generate LLMS.txt
  let llmsTxt = `# Aluvantis Blog\n\n`;
  llmsTxt += `> Aluvantis korporativ tahlil va raqamli innovatsiyalar portali. CEO Anvar boshchiligida raqamli transformatsiya, IT arxitektura va zamonaviy biznes strategiyalari.\n\n`;
  llmsTxt += `## Asosiy Ma'lumotlar\n`;
  llmsTxt += `- Tashkilot: Aluvantis\n`;
  llmsTxt += `- Asoschi va CEO: Anvar\n`;
  llmsTxt += `- Veb-sayt: ${siteUrl}\n`;
  llmsTxt += `- RSS Tasmasi: ${siteUrl}/feed.xml\n`;
  llmsTxt += `- Sitemap: ${siteUrl}/sitemap.xml\n\n`;

  llmsTxt += `## Maqolalar va Ekspert Tahlillari\n\n`;
  for (const post of posts) {
    const postUrl = `${siteUrl}/post/${post.slug}`;
    llmsTxt += `### [${post.title}](${postUrl})\n`;
    llmsTxt += `- **Sana**: ${post.date || post.createdAt}\n`;
    llmsTxt += `- **Muallif**: ${post.author?.name || "Anvar (CEO Aluvantis)"}\n`;
    llmsTxt += `- **Xulosa**: ${post.excerpt || (post.content || "").substring(0, 160)}\n\n`;
  }

  // 5. Generate _redirects for Cloudflare Pages & Netlify SPA routing
  const redirectsContent = `/sitemap.xml  /sitemap.xml  200
/robots.txt   /robots.txt   200
/feed.xml     /feed.xml     200
/rss.xml      /rss.xml      200
/llms.txt     /llms.txt     200
/*            /index.html   200\n`;

  // 6. Generate vercel.json for Vercel SPA routing
  const vercelJsonContent = JSON.stringify(
    {
      rewrites: [
        { source: "/sitemap.xml", destination: "/sitemap.xml" },
        { source: "/robots.txt", destination: "/robots.txt" },
        { source: "/feed.xml", destination: "/feed.xml" },
        { source: "/rss.xml", destination: "/rss.xml" },
        { source: "/llms.txt", destination: "/llms.txt" },
        { source: "/(.*)", destination: "/index.html" },
      ],
    },
    null,
    2
  );

  // 7. Generate .htaccess for Apache / cPanel hosting
  const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>\n`;

  // Target directories to write files
  const targetDirs = [
    path.resolve(process.cwd(), "public"),
    path.resolve(process.cwd(), "dist"),
  ];

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(path.join(dir, "sitemap.xml"), xml, "utf-8");
    fs.writeFileSync(path.join(dir, "robots.txt"), robotsText, "utf-8");
    fs.writeFileSync(path.join(dir, "feed.xml"), rss, "utf-8");
    fs.writeFileSync(path.join(dir, "rss.xml"), rss, "utf-8");
    fs.writeFileSync(path.join(dir, "llms.txt"), llmsTxt, "utf-8");
    fs.writeFileSync(path.join(dir, "_redirects"), redirectsContent, "utf-8");
    fs.writeFileSync(path.join(dir, "vercel.json"), vercelJsonContent, "utf-8");
    fs.writeFileSync(path.join(dir, ".htaccess"), htaccessContent, "utf-8");

    console.log(`✓ Generated sitemap.xml, robots.txt, feed.xml, rss.xml, llms.txt, _redirects, vercel.json, .htaccess in ${dir}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("generate-seo.ts")) {
  generateSeoFiles();
}
