import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Lightbox } from "../components/Lightbox";
import { FadeImage } from "../components/FadeImage";
import { SEOHead } from "../components/SEOHead";
import { BlogPostData } from "../server/telegramDb";
import { Send, Plus } from "lucide-react";
import { Link } from "react-router-dom";

export function Photography() {
  const [posts, setPosts] = useState<BlogPostData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/posts");
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (e) {
      console.error("Error fetching photography gallery:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Build photo collection from real Telegram posts (cover images & gallery photos)
  const photosList: { src: string; caption: string; title: string }[] = [];
  posts.forEach((p) => {
    if (p.coverImage) {
      photosList.push({
        src: p.coverImage,
        caption: p.title,
        title: p.title,
      });
    }
    if (p.mediaGallery && p.mediaGallery.length > 0) {
      p.mediaGallery.forEach((imgUrl) => {
        photosList.push({
          src: imgUrl,
          caption: p.title,
          title: p.title,
        });
      });
    }
  });

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SEOHead
        title="Media va Fotogalereya — Aluvantis"
        description="Aluvantis media arxivi, korporativ fotolavhalar, biznes tadbirlar va loyihalardan saralangan fotosuratlar to'plami."
        image={photosList[0]?.src || "/logo.png"}
        type="website"
        keywords={["fotogalereya", "Aluvantis media", "fotosuratlar", "biznes fotolavhalar"]}
      />
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mb-12"
          >
            <h1 className="font-serif text-5xl font-medium tracking-tight text-ink md:text-6xl">
              Fotogalereya
            </h1>
            <p className="mt-4 text-lg text-ink-light max-w-2xl">
              Telegram guruhi xotirasidan real vaqtda dinamik ravishda yuklanadigan haqiqiy media arxivi.
            </p>
          </motion.div>
        </div>

        {/* Full Bleed Masonry Grid */}
        <div className="w-full px-4 sm:px-6 lg:px-8 pb-12">
          {isLoading ? (
            <p className="text-center font-serif text-ink-light">Yuklanmoqda...</p>
          ) : photosList.length > 0 ? (
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
              {photosList.map((photo, idx) => (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "100px" }}
                  transition={{ duration: 0.6, delay: (idx % 4) * 0.1 }}
                  onClick={() => setSelectedIndex(idx)}
                  className="group relative block w-full break-inside-avoid overflow-hidden rounded-2xl bg-ink/5 cursor-zoom-in border border-ink/10"
                >
                  <FadeImage
                    src={photo.src}
                    alt={photo.caption}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="absolute bottom-0 left-0 w-full p-4 translate-y-2 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 text-left">
                    <p className="text-white font-serif text-sm font-medium drop-shadow-sm">{photo.caption}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="p-12 rounded-3xl border border-dashed border-ink/20 bg-white/60 text-center space-y-4 max-w-lg mx-auto my-8">
              <h3 className="font-serif text-xl font-medium text-ink">Galereyada Rasmlar Yo'q</h3>
              <p className="text-sm text-ink-light">
                Telegram bot (**@AnvarBlogBot**) yoki Admin paneldan rasm va videolar bilan maqolalar yarating!
              </p>
              <a
                href="https://t.me/AnvarBlogBot"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-medium"
              >
                <Send className="w-4 h-4" />
                <span>Telegram Bot (@AnvarBlogBot)</span>
              </a>
            </div>
          )}
        </div>
      </main>
      <Footer />

      <Lightbox
        isOpen={selectedIndex !== null}
        onClose={() => setSelectedIndex(null)}
        src={selectedIndex !== null ? photosList[selectedIndex].src : ""}
        alt={selectedIndex !== null ? photosList[selectedIndex].title : ""}
        caption={selectedIndex !== null ? photosList[selectedIndex].caption : ""}
      />
    </div>
  );
}
