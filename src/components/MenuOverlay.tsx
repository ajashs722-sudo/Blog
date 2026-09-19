import { motion, AnimatePresence } from "motion/react";
import { X, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { ThemeToggle } from "./ThemeToggle";

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

interface MenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MenuOverlay({ isOpen, onClose }: MenuOverlayProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const links = [
    { name: "Bosh Sahifa", path: "/" },
    { name: "Haqida", path: "/about" },
    { name: "Essalar", path: "/" },
    { name: "Fotosuratlar", path: "/photography" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-[100] w-full max-w-sm bg-paper shadow-2xl flex flex-col"
          >
            <div className="flex justify-between items-center p-6 border-b border-ink/5">
              <div className="flex items-center gap-2">
                <span className="font-serif text-lg font-semibold tracking-wide">ALUVANTIS</span>
                <span className="rounded bg-ink/5 px-1.5 py-0.5 font-sans text-[10px] font-semibold tracking-widest uppercase text-accent">
                  BLOG
                </span>
              </div>
              <button onClick={onClose} className="p-2 text-ink-light hover:text-ink transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <nav className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 justify-center">
              {links.map((link, idx) => (
                <motion.div
                  key={link.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + idx * 0.1 }}
                >
                  <Link 
                    to={link.path} 
                    onClick={onClose}
                    className="font-serif text-4xl text-ink hover:text-accent transition-colors"
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}
            </nav>
            
            <div className="p-6 border-t border-ink/5 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-wider text-ink-light">
                <a 
                  href="https://www.instagram.com/aluvantis?stkn=MWI5Z2N3bjdjYnNwYw==" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="inline-flex items-center gap-1.5 hover:text-accent transition-colors"
                >
                  <InstagramIcon className="h-4 w-4 text-accent" />
                  <span>Instagram</span>
                </a>
                <a 
                  href="https://t.me/Aluvantis" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="inline-flex items-center gap-1.5 hover:text-accent transition-colors"
                >
                  <Send className="h-4 w-4 text-accent" />
                  <span>Telegram</span>
                </a>
              </div>
              <ThemeToggle showLabel />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
