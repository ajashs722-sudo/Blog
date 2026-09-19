import { motion, AnimatePresence } from "motion/react";
import { Search, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<any[]>([]);
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setQuery("");
      // Fetch dynamic posts to search inside real Telegram DB posts
      fetch("/api/posts")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setPosts(data);
          }
        })
        .catch(err => console.error("Error fetching posts for search:", err));
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const results = query.length > 1 
    ? posts.filter(a => 
        a.title.toLowerCase().includes(query.toLowerCase()) || 
        (a.excerpt && a.excerpt.toLowerCase().includes(query.toLowerCase())) ||
        (a.tags && a.tags.some((t: string) => t.toLowerCase().includes(query.toLowerCase())))
      )
    : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] bg-paper/95 backdrop-blur-md flex flex-col"
        >
          <div className="flex justify-end p-6">
            <button 
              onClick={onClose} 
              className="p-2 text-ink-light hover:text-ink transition-colors"
              aria-label="Qidiruvni yopish"
            >
              <X className="h-8 w-8" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-24">
            <div className="mx-auto max-w-3xl pt-8">
              <div className="relative">
                <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 text-ink-light" />
                <input 
                  type="text" 
                  placeholder="Maqolalar, mavzular, kalit so'zlarni qidirish..." 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-transparent border-b-2 border-ink/20 py-4 pl-12 pr-4 text-2xl sm:text-3xl font-serif text-ink placeholder:text-ink/30 focus:border-accent focus:outline-none transition-colors"
                />
              </div>
              
              <div className="mt-12 flex flex-col gap-8">
                {query.length > 1 && results.length === 0 && (
                  <p className="text-ink-light text-lg">"{query}" kalit so'zi bo'yicha hech qanday natija topilmadi.</p>
                )}
                {results.map((article, idx) => (
                  <motion.div 
                    key={article.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-b border-ink/5 pb-6"
                  >
                    <Link to={`/post/${article.slug}`} onClick={onClose} className="group block">
                      <span className="text-xs font-medium uppercase tracking-wider text-accent mb-1.5 block">
                        {article.tags?.join(" · ")}
                      </span>
                      <h3 className="font-serif text-2xl text-ink group-hover:text-accent transition-colors mb-2">
                        {article.title}
                      </h3>
                      <p className="text-ink-light line-clamp-2 text-sm">{article.excerpt}</p>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

