import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
  publishedTime?: string;
  authorName?: string;
  tags?: string[];
  keywords?: string[];
  videoUrl?: string;
  youtubeUrl?: string;
  quoteText?: string;
  quoteAuthor?: string;
}

export function SEOHead({
  title = "Aluvantis — Biznes va Innovatsiyalar Portali",
  description = "Aluvantis korporativ tahlil va raqamli innovatsiyalar portali. CEO Anvar boshchiligida raqamli transformatsiya va biznes strategiyalari.",
  image = "https://blog.aluvantis.uz/logo.png",
  url,
  type = "website",
  publishedTime,
  authorName = "Anvar (CEO Aluvantis)",
  tags = [],
  keywords = [],
  videoUrl,
  youtubeUrl,
  quoteText,
  quoteAuthor,
}: SEOProps) {
  useEffect(() => {
    // 1. Title
    const formattedTitle = title.includes("Aluvantis") ? title : `${title} — Aluvantis`;
    document.title = formattedTitle;

    const currentUrl = url || (typeof window !== "undefined" ? window.location.href : "https://blog.aluvantis.uz");

    // Helper to set or create meta tag
    const setMeta = (attr: "name" | "property", key: string, content: string) => {
      let element = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attr, key);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // Standard SEO & Indexing
    setMeta("name", "description", description);
    setMeta("name", "author", authorName);
    
    // Dynamic Keywords
    const allKeywords = Array.from(new Set([
      "Aluvantis",
      "Aluvantis blog",
      "CEO Anvar",
      "biznes tahlil",
      "raqamli transformatsiya",
      "sun'iy intellekt",
      "IT yangiliklar",
      "investitsiyalar",
      ...tags,
      ...keywords,
    ])).join(", ");
    setMeta("name", "keywords", allKeywords);

    // Robots meta tags for aggressive search indexing
    setMeta("name", "robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
    setMeta("name", "googlebot", "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1");

    // OpenGraph standard
    setMeta("property", "og:site_name", "Aluvantis");
    setMeta("property", "og:type", type);
    setMeta("property", "og:title", formattedTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", currentUrl);
    setMeta("property", "og:image", image);
    setMeta("property", "og:image:secure_url", image);
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");
    setMeta("property", "og:image:alt", title);
    setMeta("property", "og:locale", "uz_UZ");

    if (videoUrl || youtubeUrl) {
      setMeta("property", "og:video", videoUrl || youtubeUrl || "");
    }

    if (type === "article" && publishedTime) {
      setMeta("property", "article:published_time", publishedTime);
      setMeta("property", "article:author", authorName);
      tags.forEach((tag) => setMeta("property", "article:tag", tag));
    }

    // Twitter Card (Large Image)
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:site", "@aluvantis");
    setMeta("name", "twitter:creator", "@aluvantis");
    setMeta("name", "twitter:title", formattedTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);
    setMeta("name", "twitter:image:alt", title);

    // Schema.org JSON-LD for Search Engines & Social Platforms
    let scriptEl = document.getElementById("seo-schema-jsonld") as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.id = "seo-schema-jsonld";
      scriptEl.type = "application/ld+json";
      document.head.appendChild(scriptEl);
    }

    const schemaData: any =
      type === "article"
        ? {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": "https://blog.aluvantis.uz/#organization",
                "name": "Aluvantis",
                "url": "https://blog.aluvantis.uz",
                "logo": {
                  "@type": "ImageObject",
                  "@id": "https://blog.aluvantis.uz/#logo",
                  "url": "https://blog.aluvantis.uz/logo.png",
                  "width": 512,
                  "height": 512,
                  "caption": "Aluvantis Logo"
                },
                "founder": {
                  "@id": "https://blog.aluvantis.uz/about#author"
                }
              },
              {
                "@type": "Person",
                "@id": "https://blog.aluvantis.uz/about#author",
                "name": authorName,
                "jobTitle": "CEO",
                "worksFor": {
                  "@id": "https://blog.aluvantis.uz/#organization"
                },
                "url": "https://blog.aluvantis.uz/about",
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
                "@id": "https://blog.aluvantis.uz/#website",
                "url": "https://blog.aluvantis.uz",
                "name": "Aluvantis",
                "publisher": {
                  "@id": "https://blog.aluvantis.uz/#organization"
                }
              },
              {
                "@type": "BlogPosting",
                "@id": `${currentUrl}/#article`,
                "isPartOf": {
                  "@id": "https://blog.aluvantis.uz/#website"
                },
                "headline": title,
                "description": description,
                "abstract": description,
                "speakable": {
                  "@type": "SpeakableSpecification",
                  "cssSelector": [".executive-summary-text", ".article-title-heading"]
                },
                "image": [image],
                "datePublished": publishedTime || new Date().toISOString(),
                "inLanguage": "uz",
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": currentUrl
                },
                "author": {
                  "@id": "https://blog.aluvantis.uz/about#author"
                },
                "publisher": {
                  "@id": "https://blog.aluvantis.uz/#organization"
                },
                "keywords": allKeywords,
                ...(videoUrl || youtubeUrl
                  ? {
                      "video": {
                        "@type": "VideoObject",
                        "name": title,
                        "description": description,
                        "thumbnailUrl": [image],
                        "uploadDate": publishedTime || new Date().toISOString(),
                        "contentUrl": videoUrl || youtubeUrl,
                        "embedUrl": youtubeUrl || videoUrl,
                      },
                    }
                  : {}),
                ...(quoteText
                  ? {
                      "citation": {
                        "@type": "Quotation",
                        "text": quoteText,
                        "creator": quoteAuthor || authorName,
                      },
                    }
                  : {}),
              },
              {
                "@type": "BreadcrumbList",
                "@id": `${currentUrl}/#breadcrumb`,
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Bosh sahifa",
                    "item": "https://blog.aluvantis.uz"
                  },
                  {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Maqolalar",
                    "item": "https://blog.aluvantis.uz"
                  },
                  {
                    "@type": "ListItem",
                    "position": 3,
                    "name": title,
                    "item": currentUrl
                  }
                ]
              }
            ]
          }
        : {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": "https://blog.aluvantis.uz/#organization",
                "name": "Aluvantis",
                "url": "https://blog.aluvantis.uz",
                "logo": {
                  "@type": "ImageObject",
                  "@id": "https://blog.aluvantis.uz/#logo",
                  "url": "https://blog.aluvantis.uz/logo.png",
                  "width": 512,
                  "height": 512,
                  "caption": "Aluvantis Logo"
                },
                "founder": {
                  "@id": "https://blog.aluvantis.uz/about#author"
                }
              },
              {
                "@type": "Person",
                "@id": "https://blog.aluvantis.uz/about#author",
                "name": authorName || "Anvar",
                "jobTitle": "CEO",
                "worksFor": {
                  "@id": "https://blog.aluvantis.uz/#organization"
                },
                "url": "https://blog.aluvantis.uz/about"
              },
              {
                "@type": "WebSite",
                "@id": "https://blog.aluvantis.uz/#website",
                "name": "Aluvantis",
                "description": description,
                "url": currentUrl,
                "publisher": {
                  "@id": "https://blog.aluvantis.uz/#organization"
                }
              }
            ]
          };

    scriptEl.text = JSON.stringify(schemaData);
  }, [title, description, image, url, type, publishedTime, authorName, tags, keywords, videoUrl, youtubeUrl, quoteText, quoteAuthor]);

  return null;
}
