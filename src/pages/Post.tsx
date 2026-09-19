import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "motion/react";
import { getYoutubeDetails } from "../utils/youtube";
import { articles, Article } from "../data/articles";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { AuthorInfo } from "../components/AuthorInfo";
import { QuoteEmbed } from "../components/QuoteEmbed";
import { Gallery } from "../components/Gallery";
import { FadeImage } from "../components/FadeImage";
import { ShareButtons } from "../components/ShareButtons";
import { SEOHead } from "../components/SEOHead";
import { VideoSection } from "../components/VideoSection";

export function Post() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(() => {
    return articles.find((a) => a.slug === slug || a.id === slug) || null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!article);
  const [fetchError, setFetchError] = useState<boolean>(false);

  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 1000], [0, 300]);
  const opacity = useTransform(scrollY, [0, 500], [1, 0]);

  useEffect(() => {
    if (slug) {
      setIsLoading(true);
      fetch(`/api/posts/${slug}`)
        .then((res) => {
          if (!res.ok) throw new Error("Post not found");
          return res.json();
        })
        .then((data) => {
          if (data && !data.error) {
            setArticle(data);
            setFetchError(false);
          } else {
            setFetchError(true);
          }
        })
        .catch((e) => {
          console.error("Error fetching post from API:", e);
          setFetchError(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-paper">
        <Header />
        <main className="flex-1 flex items-center justify-center p-12">
          <p className="font-serif text-lg text-ink-light animate-pulse">Maqola yuklanmoqda...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (fetchError || !article) {
    return <Navigate to="/" replace />;
  }

  const { embedUrl: youtubeEmbed, isShorts: isYoutubeShortsMedia } = getYoutubeDetails(article.youtubeUrl);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SEOHead
        title={article.title}
        description={article.excerpt}
        image={article.coverImage}
        type="article"
        authorName={article.author.name}
        publishedTime={article.date}
        tags={article.tags}
        videoUrl={article.videoUrl}
        youtubeUrl={article.youtubeUrl}
        quoteText={article.quote?.text}
        quoteAuthor={article.quote?.author}
      />
      <Header />
      
      <main className="flex-1">
        {/* Immersive Hero */}
        <div className="relative h-[70vh] min-h-[500px] w-full overflow-hidden bg-neutral-950">
          <motion.div 
            style={{ y, opacity }}
            className="absolute inset-0"
          >
            <FadeImage 
              src={article.coverImage} 
              alt={article.title} 
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover opacity-70"
            />
          </motion.div>
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
          
          <div className="absolute bottom-0 left-0 w-full p-6 sm:p-12 md:p-24">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto max-w-4xl"
            >
              <div className="mb-4 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-white/80">
                <span>{article.date}</span>
              </div>
              
              <h1 id="article-headline" className="article-title-heading font-serif text-4xl font-medium leading-tight tracking-tight text-white drop-shadow-md sm:text-5xl md:text-6xl lg:text-7xl break-words break-all [overflow-wrap:anywhere]">
                {article.title}
              </h1>
            </motion.div>
          </div>
        </div>
        
        {/* Content */}
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24 overflow-hidden max-w-full">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="prose prose-lg prose-stone max-w-none prose-headings:font-serif prose-headings:font-medium prose-headings:tracking-tight prose-p:leading-relaxed prose-p:text-ink-light prose-a:text-accent prose-a:no-underline hover:prose-a:underline break-words break-all [overflow-wrap:anywhere]"
          >
            <p className="lead text-2xl font-serif italic text-ink mb-8 break-words break-all [overflow-wrap:anywhere]">
              {article.excerpt}
            </p>
            
            <div className="not-prose flex flex-wrap items-center justify-between gap-4 border-y border-ink/10 py-4 mb-12">
              <div className="flex items-center gap-3">
                <FadeImage
                  src={article.author.avatar}
                  alt={article.author.name}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-full object-cover shrink-0"
                />
                <div className="flex flex-col text-xs">
                  <span className="font-medium text-ink">{article.author.name}</span>
                  <span className="text-ink-light">{article.date}</span>
                </div>
              </div>
            </div>

            {/* Video Section Carousel / Card with Light & Dark mode support */}
            <VideoSection 
              youtubeUrl={article.youtubeUrl}
              videoUrl={article.videoUrl}
              title={article.title}
            />

            {/* Quote Embed if present */}
            {article.quote?.text && (
              <QuoteEmbed 
                quote={article.quote.text}
                author={article.quote.author || article.author.name}
              />
            )}

            {/* Main Content Body */}
            {article.content ? (
              <div className="whitespace-pre-wrap text-ink-light leading-relaxed my-8 space-y-6 text-lg break-words break-all [overflow-wrap:anywhere]">
                {article.content}
              </div>
            ) : (
              <div className="text-ink-light leading-relaxed my-8 text-lg break-words break-all [overflow-wrap:anywhere]">
                {article.excerpt}
              </div>
            )}

            {/* Additional Media Gallery if present */}
            {article.mediaGallery && article.mediaGallery.length > 0 && (
              <Gallery 
                images={article.mediaGallery.map((img, idx) => ({
                  src: img,
                  alt: `Gallery image ${idx + 1}`
                }))}
              />
            )}

            {/* Bottom Share Bar */}
            <div className="not-prose mt-16 pt-8 border-t border-ink/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-light">
                <span className="font-semibold uppercase tracking-wider text-ink mr-1">Mavzular:</span>
                <span>{article.tags.join(" · ")}</span>
              </div>
              <ShareButtons title={article.title} />
            </div>
          </motion.div>
          
          <AuthorInfo author={article.author} />
        </article>
      </main>
      
      <Footer />
    </div>
  );
}
