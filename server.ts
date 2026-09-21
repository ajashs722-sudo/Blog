import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { generateSeoFiles } from "./scripts/generate-seo";
import { articles, defaultAuthor } from "./src/data/articles";
import {
  getAllPostsFromStore,
  getPostBySlugFromStore,
  addSubscriber,
  getSubscribersList,
  handleTelegramWebhookUpdate,
  callTelegramApi,
  getGroupChatIds,
  registerBotCommands,
  getSystemStats,
} from "./src/server/telegramDb";
import { getObjectFromR2, getPresignedDownloadUrl } from "./src/server/r2";
import { SubscriberSchema, TelegramUpdateSchema } from "./src/server/validation";

const PORT = 3000;

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parsePostDate(dateStr?: string, fallback?: string): string {
  if (fallback) {
    const d = new Date(fallback);
    if (!isNaN(d.getTime())) return d.toUTCString();
  }
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toUTCString();
  }
  return new Date().toUTCString();
}

function getSiteBaseUrl(host: string, protocol: string): string {
  // Local development testing
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return `${protocol}://${host}`;
  }
  // If a custom production APP_URL is provided (and not an internal sandbox .run.app URL)
  if (process.env.APP_URL && !process.env.APP_URL.includes(".run.app") && !process.env.APP_URL.includes("localhost")) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  // Primary canonical domain for Aluvantis Blog
  return "https://blog.aluvantis.uz";
}

function injectMetadata(rawHtml: string, reqUrl: string, host: string, protocol: string) {
  const siteUrl = getSiteBaseUrl(host, protocol);
  const fullUrl = `${siteUrl}${reqUrl}`;
  const slugMatch = reqUrl.match(/^\/post\/([a-zA-Z0-9_-]+)/);

  let title = "Aluvantis — Biznes va Innovatsiyalar Portali";
  let description =
    "Aluvantis korporativ tahlil va raqamli innovatsiyalar portali. CEO Anvar boshchiligida raqamli transformatsiya va biznes strategiyalari.";
  let keywords = "Aluvantis, Aluvantis blog, CEO Anvar, biznes tahlil, raqamli transformatsiya, sun'iy intellekt, IT yangiliklar, investitsiyalar, innovatsiya, O'zbekiston biznes";
  let image = `${siteUrl}/logo.png`;
  let type = "website";
  let author = "Anvar (CEO Aluvantis)";
  let schemaJson = "";
  let videoMeta = "";

  if (slugMatch) {
    const slug = slugMatch[1];
    const article = getPostBySlugFromStore(slug);
    if (article) {
      title = `${article.title} — Aluvantis`;
      description = article.excerpt || article.content.substring(0, 160).replace(/\r?\n|\r/g, " ");
      image = article.coverImage;
      if (!image.startsWith("http")) {
        image = `${siteUrl}${image}`;
      }
      type = "article";
      if (article.tags && article.tags.length > 0) {
        keywords = `${article.tags.join(", ")}, ${keywords}`;
      }
      author = article.author?.name || "Anvar (CEO Aluvantis)";

      if (article.videoUrl || article.youtubeUrl) {
        const vUrl = article.videoUrl || article.youtubeUrl || "";
        videoMeta = `\n  <meta property="og:video" content="${escapeHtml(vUrl)}" />\n  <meta name="twitter:player" content="${escapeHtml(vUrl)}" />`;
      }

      // JSON-LD for BlogPosting with Knowledge Graph Interlinking (Perfect for GEO / AIO / Google / Perplexity)
      const authorAvatar = article.author?.avatar 
        ? (article.author.avatar.startsWith("http") ? article.author.avatar : `${siteUrl}${article.author.avatar}`) 
        : `${siteUrl}${defaultAuthor.avatar}`;

      const schemaData: any = {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${siteUrl}/#organization`,
            "name": "Aluvantis",
            "url": siteUrl,
            "logo": {
              "@type": "ImageObject",
              "@id": `${siteUrl}/#logo`,
              "url": `${siteUrl}/logo.png`,
              "width": 512,
              "height": 512,
              "caption": "Aluvantis Logo"
            },
            "founder": {
              "@id": `${siteUrl}/about#author`
            }
          },
          {
            "@type": "Person",
            "@id": `${siteUrl}/about#author`,
            "name": article.author?.name || defaultAuthor.name,
            "jobTitle": "CEO",
            "worksFor": {
              "@id": `${siteUrl}/#organization`
            },
            "image": authorAvatar,
            "url": `${siteUrl}/about`,
            "knowsAbout": [
              "Biznes boshqaruvi va strategiya",
              "Raqamli transformatsiya",
              "Sun'iy intellekt va avtomatlashtirish",
              "IT arxitektura",
              "Investitsiyalar va startaplar"
            ]
          },
          {
            "@type": "WebSite",
            "@id": `${siteUrl}/#website`,
            "url": siteUrl,
            "name": "Aluvantis",
            "publisher": {
              "@id": `${siteUrl}/#organization`
            }
          },
          {
            "@type": "BlogPosting",
            "@id": `${fullUrl}/#article`,
            "isPartOf": {
              "@id": `${siteUrl}/#website`
            },
            "headline": article.title,
            "description": description,
            "abstract": description,
            "speakable": {
              "@type": "SpeakableSpecification",
              "cssSelector": [".executive-summary-text", ".article-title-heading"]
            },
            "image": [image],
            "datePublished": article.date || article.createdAt,
            "dateModified": article.updatedAt || article.createdAt,
            "inLanguage": "uz",
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": fullUrl
            },
            "author": {
              "@id": `${siteUrl}/about#author`
            },
            "publisher": {
              "@id": `${siteUrl}/#organization`
            },
            "keywords": keywords,
            "articleBody": article.content,
            "wordCount": article.content ? article.content.split(/\s+/).length : 0,
            ...(article.videoUrl || article.youtubeUrl
              ? {
                  "video": {
                    "@type": "VideoObject",
                    "name": article.title,
                    "description": description,
                    "thumbnailUrl": [image],
                    "uploadDate": article.date || article.createdAt,
                    "contentUrl": article.videoUrl || article.youtubeUrl,
                    "embedUrl": article.youtubeUrl || article.videoUrl
                  }
                }
              : {}),
            ...(article.quote?.text
              ? {
                  "citation": {
                    "@type": "Quotation",
                    "text": article.quote.text,
                    "creator": article.quote.author || author
                  }
                }
              : {}),
          },
          {
            "@type": "BreadcrumbList",
            "@id": `${fullUrl}/#breadcrumb`,
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Bosh sahifa",
                "item": siteUrl
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Maqolalar",
                "item": siteUrl
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": article.title,
                "item": fullUrl
              }
            ]
          }
        ]
      };

      schemaJson = `\n  <script type="application/ld+json">${JSON.stringify(schemaData)}</script>`;
    }
  } else if (reqUrl.startsWith("/about")) {
    title = "Anvar (CEO) — Aluvantis Kompaniyasi Haqida";
    description = defaultAuthor.bio;
    keywords = "Anvar, CEO Aluvantis, Aluvantis haqida, biznes strategiyasi, raqamli transformatsiya, innovatsiya, Aluvantis jamoasi";
    image = defaultAuthor.avatar;
    if (!image.startsWith("http")) {
      image = `${siteUrl}${image}`;
    }

    // JSON-LD for Author / About Page
    const schemaData = {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "name": title,
      "description": description,
      "url": fullUrl,
      "mainEntity": {
        "@type": "Person",
        "name": defaultAuthor.name,
        "jobTitle": "CEO",
        "worksFor": {
          "@type": "Organization",
          "name": "Aluvantis",
          "url": `${siteUrl}`
        },
        "image": image,
        "description": description
      }
    };
    schemaJson = `\n  <script type="application/ld+json">${JSON.stringify(schemaData)}</script>`;
  } else if (reqUrl.startsWith("/photography")) {
    title = "Media va Fotogalereya — Aluvantis";
    description = "Aluvantis media arxivi, korporativ fotolavhalar, biznes tadbirlar va loyihalardan saralangan fotosuratlar to'plami.";
    keywords = "Aluvantis fotogalereya, media arxivi, fotosuratlar, biznes lavhalar, Aluvantis media";
    image = `${siteUrl}/logo.png`;

    // JSON-LD for Photography Collection Page
    const schemaData = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": title,
      "description": description,
      "url": fullUrl,
      "image": image
    };
    schemaJson = `\n  <script type="application/ld+json">${JSON.stringify(schemaData)}</script>`;
  } else {
    // JSON-LD for Home
    const schemaData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          "url": `${siteUrl}`,
          "name": "Aluvantis",
          "description": description,
          "inLanguage": "uz",
          "publisher": {
            "@id": `${siteUrl}/#organization`
          },
          "potentialAction": {
            "@type": "SearchAction",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": `${siteUrl}/?s={search_term_string}`
            },
            "query-input": "required name=search_term_string"
          }
        },
        {
          "@type": "Organization",
          "@id": `${siteUrl}/#organization`,
          "name": "Aluvantis",
          "url": `${siteUrl}`,
          "logo": {
            "@type": "ImageObject",
            "url": `${siteUrl}/logo.png`,
            "width": 512,
            "height": 512,
            "caption": "Aluvantis Logo"
          },
          "image": {
            "@type": "ImageObject",
            "url": `${siteUrl}/logo.png`
          },
          "founder": {
            "@type": "Person",
            "name": "Anvar",
            "jobTitle": "CEO",
            "url": `${siteUrl}/about`
          }
        }
      ]
    };
    schemaJson = `\n  <script type="application/ld+json">${JSON.stringify(schemaData)}</script>`;
  }

  let html = rawHtml;

  // Replace Title
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  // Replace or inject Meta Description
  if (/<meta\s+name=["']description["']/i.test(html)) {
    html = html.replace(
      /<meta\s+name=["']description["']\s+content=["'].*?["']\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(description)}" />`
    );
  } else {
    html = html.replace("</head>", `  <meta name="description" content="${escapeHtml(description)}" />\n</head>`);
  }

  // Keywords
  if (/<meta\s+name=["']keywords["']/i.test(html)) {
    html = html.replace(
      /<meta\s+name=["']keywords["']\s+content=["'].*?["']\s*\/?>/i,
      `<meta name="keywords" content="${escapeHtml(keywords)}" />`
    );
  } else {
    html = html.replace("</head>", `  <meta name="keywords" content="${escapeHtml(keywords)}" />\n</head>`);
  }

  // Author
  if (/<meta\s+name=["']author["']/i.test(html)) {
    html = html.replace(
      /<meta\s+name=["']author["']\s+content=["'].*?["']\s*\/?>/i,
      `<meta name="author" content="${escapeHtml(author)}" />`
    );
  }

  // Canonical link
  if (/<link\s+rel=["']canonical["']/i.test(html)) {
    html = html.replace(
      /<link\s+rel=["']canonical["']\s+href=["'].*?["']\s*\/?>/i,
      `<link rel="canonical" href="${escapeHtml(fullUrl)}" />`
    );
  } else {
    html = html.replace("</head>", `  <link rel="canonical" href="${escapeHtml(fullUrl)}" />\n</head>`);
  }

  // OpenGraph tags
  html = html.replace(
    /<meta\s+property=["']og:title["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(title)}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:description["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(description)}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:image["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:image" content="${escapeHtml(image)}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:image:secure_url["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:image:secure_url" content="${escapeHtml(image)}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:url["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtml(fullUrl)}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:type["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta property="og:type" content="${escapeHtml(type)}" />`
  );

  // Twitter Card tags
  html = html.replace(
    /<meta\s+name=["']twitter:title["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`
  );
  html = html.replace(
    /<meta\s+name=["']twitter:description["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`
  );
  html = html.replace(
    /<meta\s+name=["']twitter:image["']\s+content=["'].*?["']\s*\/?>/i,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`
  );

  // If videoMeta, inject before </head>
  if (videoMeta) {
    html = html.replace("</head>", `${videoMeta}\n</head>`);
  }

  // Remove existing static JSON-LD if replacing
  html = html.replace(/<script type="application\/ld\+json" id="seo-schema-jsonld">[\s\S]*?<\/script>/i, "");

  // Inject fresh JSON-LD right before </head>
  if (schemaJson) {
    html = html.replace("</head>", `${schemaJson}\n</head>`);
  }

  return html;
}

// Background long polling for Telegram updates
async function startTelegramPolling() {
  let lastUpdateId = 0;
  console.log("Starting Telegram Bot long-polling daemon...");

  const pollLoop = async () => {
    try {
      const res = await callTelegramApi(
        "getUpdates",
        {
          offset: lastUpdateId + 1,
          timeout: 10,
        },
        { timeoutMs: 20000 }
      );

      if (res && res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          await handleTelegramWebhookUpdate(update);
        }
      }
    } catch (e) {
      // Ignore polling transient network errors
    } finally {
      setTimeout(pollLoop, 1000);
    }
  };

  pollLoop();
}

async function startServer() {
  const app = express();
  const isProd = process.env.NODE_ENV === "production";

  // Generate static SEO files (sitemap.xml, robots.txt, feed.xml) into public/ and dist/
  try {
    generateSeoFiles();
  } catch (e) {
    console.error("[SEO Build] Error generating static SEO files:", e);
  }

  app.use(express.json());

  // API or health check routes
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      cloudflareConfigured: Boolean(process.env.CLOUDFLARE_R2_ACCOUNT_ID),
      resolvedGroupIds: getGroupChatIds(),
    });
  });

  app.get("/api/stats", (_req, res) => {
    res.json(getSystemStats());
  });

  // REST API Routes for Blog Posts backed by Telegram Database
  app.get("/api/posts", (_req, res) => {
    const posts = getAllPostsFromStore();
    res.json(posts);
  });

  app.get("/api/posts/:slug", (req, res) => {
    const post = getPostBySlugFromStore(req.params.slug);
    if (!post) {
       return res.status(404).json({ error: "Post not found" });
    }
    res.json(post);
  });

  // Serve media files from Cloudflare R2 using AWS S3 Presigned URLs for maximum performance
  app.get("/api/media/:key", async (req, res) => {
    try {
      const key = req.params.key;
      const signedUrl = await getPresignedDownloadUrl(key);
      // HTTP 302 Temporary Redirect to direct Cloudflare CDN
      // Set short-lived cache headers on the redirect itself to avoid excessive presigning requests
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.redirect(302, signedUrl);
    } catch (error: any) {
      console.warn(`[Media API] Presigned URL failed for key ${req.params.key}, falling back to proxy stream:`, error);
      // Fallback: proxy stream from R2 if presigning fails
      try {
        const { body, contentType } = await getObjectFromR2(req.params.key);
        if (contentType) {
          res.setHeader("Content-Type", contentType);
        }
        res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
        if (body) {
          if (typeof (body as any).pipe === "function") {
            (body as any).pipe(res);
          } else if ((body as any).transformToByteArray) {
            const byteArray = await (body as any).transformToByteArray();
            res.end(Buffer.from(byteArray));
          } else {
            const chunks: any[] = [];
            for await (const chunk of body as any) {
              chunks.push(chunk);
            }
            res.end(Buffer.concat(chunks));
          }
        } else {
          res.status(404).send("Empty media body");
        }
      } catch (innerError) {
        console.error(`[Media API Fallback] Error fetching key ${req.params.key} from R2:`, innerError);
        res.status(404).send("Media not found");
      }
    }
  });

  // Subscribers Management API (Validated using Zod Schema)
  app.post("/api/subscribers", async (req, res) => {
    try {
      const validatedData = SubscriberSchema.parse(req.body);
      const sub = await addSubscriber(validatedData);
      res.status(201).json(sub);
    } catch (err: any) {
      console.warn("[Subscribers API] Validation failed for payload:", err);
      res.status(400).json({ error: err.errors || err.message || "Invalid subscriber payload" });
    }
  });

  app.get("/api/subscribers", (_req, res) => {
    const subs = getSubscribersList();
    res.json(subs);
  });

  // Telegram Webhook Handler (Validated using Zod Schema for strict payload safety)
  app.post("/api/telegram/webhook", async (req, res) => {
    res.status(200).send("OK");
    try {
      // Validate incoming Telegram payload schema
      const validatedUpdate = TelegramUpdateSchema.parse(req.body);
      await handleTelegramWebhookUpdate(validatedUpdate);
    } catch (e: any) {
      console.error("[Telegram Webhook] Payload validation or handling error:", e.errors || e.message);
    }
  });

  // Dynamic RSS Feed Route for Google News, MSN News and aggregators
  // Dynamic RSS 2.0 Feed Route (/feed.xml and /rss.xml) for Content Aggregators and News Readers
  app.get(["/feed.xml", "/rss.xml", "/feed"], (req, res) => {
    try {
      const posts = getAllPostsFromStore();
      const protocol = (req.headers["x-forwarded-proto"] || req.protocol || "https") as string;
      const host = (req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000") as string;
      const baseUrl = getSiteBaseUrl(host, protocol);

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
      rss += `    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml" />\n`;
      rss += `    <link>${baseUrl}</link>\n`;
      rss += `    <description>Aluvantis korporativ tahlil va raqamli innovatsiyalar portali. CEO Anvar boshchiligida raqamli transformatsiya va biznes strategiyalari.</description>\n`;
      rss += `    <language>uz</language>\n`;
      rss += `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;
      rss += `    <sy:updatePeriod>hourly</sy:updatePeriod>\n`;
      rss += `    <sy:updateFrequency>1</sy:updateFrequency>\n`;
      rss += `    <image>\n`;
      rss += `      <url>${baseUrl}/logo.png</url>\n`;
      rss += `      <title>Aluvantis</title>\n`;
      rss += `      <link>${baseUrl}</link>\n`;
      rss += `      <width>512</width>\n`;
      rss += `      <height>512</height>\n`;
      rss += `    </image>\n`;

      for (const post of posts) {
        const postUrl = `${baseUrl}/post/${post.slug}`;
        const imgUrl = post.coverImage.startsWith("http") ? post.coverImage : `${baseUrl}${post.coverImage}`;
        
        let formattedContent = "";
        if (post.coverImage) {
          formattedContent += `<p><img src="${imgUrl}" alt="${escapeHtml(post.title)}" /></p>\n`;
        }
        if (post.quote?.text) {
          formattedContent += `<blockquote><p>${escapeHtml(post.quote.text)}</p>${post.quote.author ? `<footer>— ${escapeHtml(post.quote.author)}</footer>` : ""}</blockquote>\n`;
        }
        const paragraphs = post.content
          .split(/\n\n+/)
          .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
          .join("\n");
        formattedContent += paragraphs;

        if (post.youtubeUrl) {
          formattedContent += `\n<p><strong>Video tahlil:</strong> <a href="${escapeHtml(post.youtubeUrl)}">${escapeHtml(post.youtubeUrl)}</a></p>`;
        }
        if (post.videoUrl) {
          const vUrl = post.videoUrl.startsWith("http") ? post.videoUrl : `${baseUrl}${post.videoUrl}`;
          formattedContent += `\n<p><video controls src="${vUrl}"></video></p>`;
        }

        rss += `    <item>\n`;
        rss += `      <title><![CDATA[${post.title}]]></title>\n`;
        rss += `      <link>${postUrl}</link>\n`;
        rss += `      <guid isPermaLink="true">${postUrl}</guid>\n`;
        rss += `      <pubDate>${parsePostDate(post.date, post.createdAt)}</pubDate>\n`;
        rss += `      <dc:creator><![CDATA[${post.author?.name || "Anvar (CEO Aluvantis)"}]]></dc:creator>\n`;
        
        if (post.tags && post.tags.length > 0) {
          for (const tag of post.tags) {
            rss += `      <category><![CDATA[${tag}]]></category>\n`;
          }
        }

        rss += `      <description><![CDATA[${post.excerpt}]]></description>\n`;
        rss += `      <content:encoded><![CDATA[${formattedContent}]]></content:encoded>\n`;
        if (post.coverImage) {
          rss += `      <enclosure url="${imgUrl}" length="0" type="image/jpeg" />\n`;
          rss += `      <media:content url="${imgUrl}" medium="image" type="image/jpeg" />\n`;
        }
        if (post.youtubeUrl || post.videoUrl) {
          const videoSrc = post.videoUrl || post.youtubeUrl;
          rss += `      <media:content url="${videoSrc}" medium="video" />\n`;
        }
        if (post.mediaGallery && post.mediaGallery.length > 0) {
          for (const galleryImg of post.mediaGallery) {
            const gUrl = galleryImg.startsWith("http") ? galleryImg : `${baseUrl}${galleryImg}`;
            rss += `      <media:content url="${gUrl}" medium="image" />\n`;
          }
        }
        rss += `    </item>\n`;
      }

      rss += `  </channel>\n`;
      rss += `</rss>`;

      res.set("Content-Type", "application/xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=1800, stale-while-revalidate=86400");
      res.status(200).send(rss);
    } catch (err) {
      console.error("[RSS API] Error generating RSS:", err);
      res.status(500).send("Error generating feed");
    }
  });

  // Dynamic Sitemap XML Route for Search Engines (Google, Yandex, Bing) with Image and Video extensions
  app.get(["/sitemap.xml", "/sitemap", "/sitemap_index.xml", "/sitemap-index.xml"], (req, res) => {
    try {
      const posts = getAllPostsFromStore();
      const protocol = (req.headers["x-forwarded-proto"] || req.protocol || "https") as string;
      const host = (req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000") as string;
      const baseUrl = getSiteBaseUrl(host, protocol);
      const today = new Date().toISOString().split("T")[0];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset \n`;
      xml += `  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
      xml += `  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n`;
      xml += `  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`;

      // Home Page
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>1.0</priority>\n`;
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${baseUrl}/logo.png</image:loc>\n`;
      xml += `      <image:title>Aluvantis Logotip</image:title>\n`;
      xml += `      <image:caption>Aluvantis korporativ tahlil va raqamli innovatsiyalar portali</image:caption>\n`;
      xml += `    </image:image>\n`;
      for (const p of posts.slice(0, 6)) {
        const pImg = p.coverImage.startsWith("http") ? p.coverImage : `${baseUrl}${p.coverImage}`;
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${pImg}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(p.title)}</image:title>\n`;
        xml += `      <image:caption>${escapeXml(p.excerpt)}</image:caption>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;

      // About Page (CEO Anvar)
      const authorImg = defaultAuthor.avatar.startsWith("http") ? defaultAuthor.avatar : `${baseUrl}${defaultAuthor.avatar}`;
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/about</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${authorImg}</image:loc>\n`;
      xml += `      <image:title>Anvar — CEO Aluvantis</image:title>\n`;
      xml += `      <image:caption>Aluvantis kompaniyasi asoschisi va bosh direktori (CEO) Anvar</image:caption>\n`;
      xml += `    </image:image>\n`;
      xml += `  </url>\n`;

      // Photography & Media Gallery Page
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/photography</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      for (const p of posts) {
        if (p.coverImage) {
          const cImg = p.coverImage.startsWith("http") ? p.coverImage : `${baseUrl}${p.coverImage}`;
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${cImg}</image:loc>\n`;
          xml += `      <image:title>${escapeXml(p.title)}</image:title>\n`;
          xml += `      <image:caption>${escapeXml(p.excerpt)}</image:caption>\n`;
          xml += `    </image:image>\n`;
        }
        if (p.mediaGallery && p.mediaGallery.length > 0) {
          for (const g of p.mediaGallery) {
            const gImg = g.startsWith("http") ? g : `${baseUrl}${g}`;
            xml += `    <image:image>\n`;
            xml += `      <image:loc>${gImg}</image:loc>\n`;
            xml += `      <image:title>${escapeXml(p.title)} — Galereya</image:title>\n`;
            xml += `    </image:image>\n`;
          }
        }
      }
      xml += `  </url>\n`;

      // Individual Blog Post Pages (Full text, cover, media gallery & videos)
      for (const post of posts) {
        const postUrl = `${baseUrl}/post/${post.slug}`;
        const postLastMod = new Date(post.updatedAt || post.createdAt || post.date).toISOString().split("T")[0];
        const imgUrl = post.coverImage.startsWith("http") ? post.coverImage : `${baseUrl}${post.coverImage}`;

        xml += `  <url>\n`;
        xml += `    <loc>${postUrl}</loc>\n`;
        xml += `    <lastmod>${postLastMod}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.9</priority>\n`;

        // Cover image
        if (post.coverImage) {
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${imgUrl}</image:loc>\n`;
          xml += `      <image:title>${escapeXml(post.title)}</image:title>\n`;
          xml += `      <image:caption>${escapeXml(post.excerpt)}</image:caption>\n`;
          xml += `    </image:image>\n`;
        }

        // Additional gallery images
        if (post.mediaGallery && post.mediaGallery.length > 0) {
          for (const g of post.mediaGallery) {
            const gImg = g.startsWith("http") ? g : `${baseUrl}${g}`;
            xml += `    <image:image>\n`;
            xml += `      <image:loc>${gImg}</image:loc>\n`;
            xml += `      <image:title>${escapeXml(post.title)} — Foto</image:title>\n`;
            xml += `    </image:image>\n`;
          }
        }

        // Video attachment indexing (Google Video Sitemap)
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
          xml += `      <video:publication_date>${new Date(post.date || post.createdAt).toISOString()}</video:publication_date>\n`;
          xml += `      <video:family_friendly>yes</video:family_friendly>\n`;
          xml += `    </video:video>\n`;
        }

        xml += `  </url>\n`;
      }

      xml += `</urlset>`;

      res.set("Content-Type", "application/xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.status(200).send(xml);
    } catch (err) {
      console.error("[Sitemap API] Error generating sitemap:", err);
      res.status(500).send("Error generating sitemap");
    }
  });

  // Dynamic Robots.txt Route for Bot Controls & 2026 AI/GEO Crawlers
  app.get(["/robots.txt", "/robot.txt"], (req, res) => {
    try {
      const protocol = (req.headers["x-forwarded-proto"] || req.protocol || "https") as string;
      const host = (req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000") as string;
      const baseUrl = getSiteBaseUrl(host, protocol);

      let text = `# Aluvantis Blog Robots.txt - 2026 AI, GEO & Search Engine Optimization\n`;
      text += `User-agent: *\n`;
      text += `Allow: /\n`;
      text += `Disallow: /api/\n`;
      text += `Allow: /api/posts\n`;
      text += `Allow: /api/media/\n\n`;

      text += `# Generative Engine Optimization (GEO / LLMO) & AI Crawlers\n`;
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
        text += `User-agent: ${agent}\nAllow: /\n\n`;
      }

      text += `# Discovery Endpoints\n`;
      text += `Sitemap: ${baseUrl}/sitemap.xml\n`;
      text += `RSS: ${baseUrl}/feed.xml\n`;
      text += `LLMs-Txt: ${baseUrl}/llms.txt\n`;

      res.set("Content-Type", "text/plain; charset=utf-8");
      res.status(200).send(text);
    } catch (err) {
      console.error("[Robots API] Error generating robots.txt:", err);
      res.status(500).send("Error generating robots.txt");
    }
  });

  // LLMS.txt standard (llmstxt.org) - Markdown manifest optimized for LLM inference, Perplexity, Cursor, ChatGPT
  app.get(["/llms.txt", "/.well-known/llms.txt"], (req, res) => {
    try {
      const protocol = (req.headers["x-forwarded-proto"] || req.protocol || "https") as string;
      const host = (req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000") as string;
      const baseUrl = getSiteBaseUrl(host, protocol);
      const posts = getAllPostsFromStore();

      let md = `# Aluvantis Blog\n\n`;
      md += `> Aluvantis korporativ tahlil va raqamli innovatsiyalar portali. CEO Anvar boshchiligida raqamli transformatsiya, IT arxitektura va zamonaviy biznes strategiyalari.\n\n`;
      md += `## Asosiy Ma'lumotlar\n`;
      md += `- Tashkilot: Aluvantis\n`;
      md += `- Asoschi va CEO: Anvar\n`;
      md += `- Veb-sayt: ${baseUrl}\n`;
      md += `- RSS Tasmasi: ${baseUrl}/feed.xml\n`;
      md += `- Sitemap: ${baseUrl}/sitemap.xml\n`;
      md += `- To'liq LLM matnlari: ${baseUrl}/llms-full.txt\n\n`;

      md += `## Maqolalar va Ekspert Tahlillari\n\n`;
      for (const post of posts) {
        const postUrl = `${baseUrl}/post/${post.slug}`;
        md += `### [${post.title}](${postUrl})\n`;
        md += `- **Sana**: ${post.date || post.createdAt}\n`;
        md += `- **Muallif**: ${post.author?.name || "Anvar (CEO Aluvantis)"}\n`;
        if (post.tags && post.tags.length > 0) {
          md += `- **Teglar**: ${post.tags.join(", ")}\n`;
        }
        md += `- **Xulosa (Direct Answer)**: ${post.excerpt || post.content.substring(0, 160)}\n\n`;
      }

      md += `## Aloqa va Muallif haqida\n`;
      md += `- [CEO Anvar va Aluvantis haqida](${baseUrl}/about): Kompaniya missiyasi, tajriba va raqamli transformatsiya keyslari.\n`;

      res.set("Content-Type", "text/markdown; charset=utf-8");
      res.status(200).send(md);
    } catch (err) {
      console.error("[llms.txt] Error generating llms.txt:", err);
      res.status(500).send("Error generating llms.txt");
    }
  });

  // LLMS-FULL.txt - Complete markdown of all articles for deep context ingestion
  app.get("/llms-full.txt", (req, res) => {
    try {
      const protocol = (req.headers["x-forwarded-proto"] || req.protocol || "https") as string;
      const host = (req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000") as string;
      const baseUrl = getSiteBaseUrl(host, protocol);
      const posts = getAllPostsFromStore();

      let md = `# Aluvantis Blog — To'liq Matnlar Arxiv (LLM Full Digest)\n\n`;
      md += `Nashr: Aluvantis (CEO Anvar)\n`;
      md += `Manzil: ${baseUrl}\n\n`;
      md += `---\n\n`;

      for (const post of posts) {
        const postUrl = `${baseUrl}/post/${post.slug}`;
        md += `# ${post.title}\n\n`;
        md += `Havola: ${postUrl}\n`;
        md += `Muallif: ${post.author?.name || "Anvar (CEO Aluvantis)"}\n`;
        md += `Sana: ${post.date || post.createdAt}\n\n`;
        md += `> ${post.excerpt}\n\n`;
        md += `${post.content}\n\n`;
        md += `---\n\n`;
      }

      res.set("Content-Type", "text/markdown; charset=utf-8");
      res.status(200).send(md);
    } catch (err) {
      console.error("[llms-full.txt] Error:", err);
      res.status(500).send("Error generating llms-full.txt");
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: "custom",
    });

    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexHtmlPath = path.resolve(process.cwd(), "index.html");
        let template = fs.readFileSync(indexHtmlPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);

        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";

        const transformed = injectMetadata(template, url, String(host), String(protocol));
        res.status(200).set({ "Content-Type": "text/html" }).end(transformed);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));

    app.get("*", (req, res) => {
      const url = req.originalUrl;
      const indexHtmlPath = path.resolve(distPath, "index.html");
      if (!fs.existsSync(indexHtmlPath)) {
        return res.status(404).send("Not found");
      }
      let template = fs.readFileSync(indexHtmlPath, "utf-8");
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";

      const transformed = injectMetadata(template, url, String(host), String(protocol));
      res.status(200).set({ "Content-Type": "text/html" }).end(transformed);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    // Register Telegram Bot Command Menu
    registerBotCommands().catch((e) => console.error("Error setting bot commands:", e));
    // Start background Telegram polling for real-time bot commands and updates
    startTelegramPolling();
  });
}

startServer();
