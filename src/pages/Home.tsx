import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Article } from "../data/articles";
import { ArticleCard } from "../components/ArticleCard";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { SEOHead } from "../components/SEOHead";
import { Send } from "lucide-react";

export function Home() {
  const [articlesList, setArticlesList] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/posts");
      if (res.ok) {
        const data = await res.json();
        setArticlesList(data);
      }
    } catch (e) {
      console.error("Error fetching posts:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const featuredArticle = articlesList[0];
  const remainingArticles = articlesList.slice(1);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SEOHead
        title="Aluvantis — Biznes va Innovatsiyalar Portali"
        description="Aluvantis korporativ yangiliklari, raqamli transformatsiya, strategik rivojlanish va texnologik tahlillar jurnali."
        image={featuredArticle?.coverImage || "/author.png"}
        type="website"
      />
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mb-12 max-w-3xl"
          >
            <h1 className="font-serif text-5xl font-medium leading-tight tracking-tight text-ink sm:text-6xl md:text-7xl">
              Aluvantis <span className="italic text-accent">Biznes</span> va Tahlil Portali.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-light sm:text-xl">
              Kompaniyaning strategik rivojlanishi, raqamli transformatsiya, ilg'or texnologiyalar va global bozordagi innovatsion yechimlar tahlili.
            </p>
          </motion.div>

          {isLoading ? (
            <div className="p-12 text-center text-ink-light font-serif">
              Yuklanmoqda...
            </div>
          ) : featuredArticle ? (
            <ArticleCard article={featuredArticle} featured index={0} />
          ) : (
            <div className="p-12 sm:p-16 rounded-3xl border border-dashed border-ink/20 bg-white/60 text-center space-y-6 my-8">
              <div className="w-16 h-16 rounded-full bg-accent/10 text-accent mx-auto flex items-center justify-center">
                <Send className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="font-serif text-2xl font-medium text-ink">Hozircha Maqolalar Yo'q</h3>
                <p className="text-sm text-ink-light leading-relaxed">
                  Barcha maqolalar Telegram guruh bazasidan avtomatik olinadi. Telegram Bot (**@AnvarBlogBot**) orqali birinchi maqolangizni chop eting!
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                <a
                  href="https://t.me/AnvarBlogBot"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>Telegram Botda Yaratish (@AnvarBlogBot)</span>
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Latest Articles */}
        {remainingArticles.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="mb-12 flex items-center justify-between border-b border-ink/10 pb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
                Barcha Maqolalar
              </h2>
              <span className="text-xs text-ink-light uppercase tracking-wider">
                {articlesList.length} ta maqola
              </span>
            </div>

            <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-2">
              {remainingArticles.map((article, idx) => (
                <ArticleCard key={article.id} article={article} index={idx + 1} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
