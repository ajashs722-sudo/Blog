import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Search, Menu } from "lucide-react";
import { useState } from "react";
import { MenuOverlay } from "./MenuOverlay";
import { SearchOverlay } from "./SearchOverlay";
import { ThemeToggle } from "./ThemeToggle";
import { ReadingProgressBar } from "./ReadingProgressBar";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();
  const isPostPage = location.pathname.startsWith("/post/");

  return (
    <>
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-50 w-full border-b border-ink/5 bg-paper/80 backdrop-blur-md transition-colors"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 text-ink-light hover:text-ink transition-colors"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </button>
          </div>
          
          <Link 
            to="/" 
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 sm:gap-2.5 max-w-[55%] sm:max-w-none justify-center group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <img 
              src="/favicon-48x48.png" 
              alt="Aluvantis Logo" 
              className="h-5 w-5 sm:h-7 sm:w-7 shrink-0 rounded-full object-cover shadow-xs border border-ink/10 group-hover:scale-105 transition-transform" 
            />
            <span className="font-serif text-sm min-[360px]:text-base sm:text-xl font-semibold tracking-wider sm:tracking-wide truncate">ALUVANTIS</span>
            <span className="shrink-0 rounded bg-ink/5 px-1 sm:px-1.5 py-0.5 font-sans text-[9px] sm:text-[10px] font-semibold tracking-widest uppercase text-accent group-hover:bg-accent group-hover:text-paper transition-colors">
              BLOG
            </span>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-ink-light hover:text-ink transition-colors"
            >
              <Search className="h-5 w-5" />
              <span className="sr-only">Search</span>
            </button>

            <ThemeToggle />

            <Link 
              to="/about" 
              className="hidden text-sm font-medium uppercase tracking-wider text-ink-light hover:text-ink sm:block transition-colors"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Haqida
            </Link>
          </div>
        </div>

        {/* Reading progress bar glued to the bottom border of navbar */}
        {isPostPage && <ReadingProgressBar />}
      </motion.header>

      <MenuOverlay isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
