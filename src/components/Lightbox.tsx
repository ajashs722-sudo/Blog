import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useEffect } from "react";
import { FadeImage } from "./FadeImage";

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  caption?: string;
}

export function Lightbox({ isOpen, onClose, src, alt, caption }: LightboxProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 backdrop-blur-lg p-4 sm:p-8"
          onClick={onClose}
        >
          <button 
            className="absolute top-6 right-6 p-2.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all z-10"
            onClick={onClose}
            aria-label="Close lightbox"
          >
            <X className="h-6 w-6" />
          </button>
          
          <motion.div 
            initial={{ scale: 0.92, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative max-h-full max-w-6xl w-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <FadeImage 
              src={src} 
              alt={alt} 
              referrerPolicy="no-referrer"
              className="max-h-[75vh] w-auto object-contain rounded-md shadow-2xl shadow-black ring-1 ring-white/10"
            />
            {caption && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="mt-6 text-center px-4"
              >
                <p className="text-white/90 font-serif text-lg md:text-xl max-w-2xl italic leading-relaxed drop-shadow-md">
                  {caption}
                </p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
