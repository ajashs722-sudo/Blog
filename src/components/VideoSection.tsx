import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Play, Film, Sparkles } from "lucide-react";
import { getYoutubeDetails } from "../utils/youtube";
import { cn } from "../lib/utils";

interface VideoSectionProps {
  youtubeUrl?: string;
  videoUrl?: string;
  title: string;
}

interface MediaItem {
  id: string;
  type: "youtube_shorts" | "youtube_video" | "direct_video";
  url: string;
  title: string;
}

export function VideoSection({ youtubeUrl, videoUrl, title }: VideoSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const mediaItems: MediaItem[] = [];

  // 1. Process YouTube URL
  if (youtubeUrl) {
    const { embedUrl, isShorts } = getYoutubeDetails(youtubeUrl);
    if (embedUrl) {
      mediaItems.push({
        id: "yt-media",
        type: isShorts ? "youtube_shorts" : "youtube_video",
        url: embedUrl,
        title: title,
      });
    }
  }

  // 2. Process Direct Video URL
  if (videoUrl) {
    mediaItems.push({
      id: "direct-video-media",
      type: "direct_video",
      url: videoUrl,
      title: title,
    });
  }

  if (mediaItems.length === 0) return null;

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const newIndex = Math.round(scrollLeft / (clientWidth * 0.8));
    setActiveIndex(Math.min(Math.max(0, newIndex), mediaItems.length - 1));
  };

  const scrollTo = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="not-prose my-12 w-full"
    >
      {/* Header bar with Light/Dark Mode adaptive styling */}
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
            <Film className="h-4 w-4" />
          </div>
          <h3 className="font-serif text-lg font-medium text-ink dark:text-stone-100">
            {mediaItems.length > 1 ? "Video Media Galereyasi" : "Biriktirilgan Video"}
          </h3>
        </div>

        {/* Navigation arrows for Horizontal Scroll */}
        {mediaItems.length > 1 && (
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => scrollTo("left")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-paper/80 text-ink shadow-sm backdrop-blur-md hover:bg-paper dark:border-white/15 dark:bg-stone-900/80 dark:text-white dark:hover:bg-stone-800 transition-colors"
              aria-label="Oldingi video"
            >
              <ChevronLeft className="h-5 w-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => scrollTo("right")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-paper/80 text-ink shadow-sm backdrop-blur-md hover:bg-paper dark:border-white/15 dark:bg-stone-900/80 dark:text-white dark:hover:bg-stone-800 transition-colors"
              aria-label="Keyingi video"
            >
              <ChevronRight className="h-5 w-5" />
            </motion.button>
          </div>
        )}
      </div>

      {/* Horizontal Scroll Carousel */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          "no-scrollbar flex w-full items-center gap-6 overflow-x-auto scroll-smooth py-2 px-1 snap-x snap-mandatory",
          mediaItems.length === 1 ? "justify-center" : "justify-start"
        )}
      >
        {mediaItems.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            className="shrink-0 snap-center flex flex-col items-center"
          >
            {item.type === "youtube_shorts" && (
              <div className="flex flex-col items-center justify-start">
                {/* Badge */}
                <div className="h-7 mb-3 inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-red-600 dark:bg-red-950/40 dark:text-red-400 shadow-sm">
                  <svg className="h-3.5 w-3.5 fill-current text-red-600 dark:text-red-400" viewBox="0 0 24 24">
                    <path d="M17.77 10.32l-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25l1.2.51-1.43.76c-1.84.96-2.53 3.23-1.56 5.06s3.24 2.53 5.07 1.56l8.44-4.5c1.29-.68 2.07-2.04 2-3.49-.07-1.42-.93-2.67-2.22-3.25zM10 14.5v-5l4.5 2.5-4.5 2.5z"/>
                  </svg>
                  <span>YouTube Shorts</span>
                </div>

                {/* Smartphone Bezel Card - Adapts to Light and Dark mode */}
                <div className="group relative w-[230px] xs:w-[250px] sm:w-[270px] rounded-[2.2rem] border border-stone-300/80 bg-stone-200/90 p-2.5 shadow-xl ring-1 ring-black/5 dark:border-neutral-800 dark:bg-neutral-900 dark:ring-white/10 transition-all duration-300 hover:shadow-2xl hover:scale-[1.01]">
                  {/* Speaker Notch */}
                  <div className="mx-auto mb-2 flex h-2.5 w-14 items-center justify-center gap-1.5 rounded-full bg-stone-300 dark:bg-neutral-950">
                    <div className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-neutral-800" />
                    <div className="h-1 w-4 rounded-full bg-stone-400 dark:bg-neutral-800" />
                  </div>

                  {/* Player Canvas */}
                  <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.6rem] bg-black shadow-inner border border-stone-300/50 dark:border-white/10">
                    <iframe
                      src={item.url}
                      title={item.title}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            )}

            {item.type === "youtube_video" && (
              <div className="flex flex-col items-center justify-start w-[280px] xs:w-[320px] sm:w-[480px] md:w-[540px]">
                {/* Badge */}
                <div className="h-7 mb-3 inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-stone-200/80 dark:bg-neutral-800/80 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-ink dark:text-stone-300 shadow-sm">
                  <Play className="h-3.5 w-3.5 fill-current text-red-600" />
                  <span>YouTube Video</span>
                </div>
                <div className="w-full rounded-3xl border border-stone-300/80 bg-stone-200/90 p-2 shadow-xl ring-1 ring-black/5 dark:border-neutral-800 dark:bg-neutral-900 dark:ring-white/10">
                  <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
                    <iframe
                      src={item.url}
                      title={item.title}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            )}

            {item.type === "direct_video" && (
              <div className="flex flex-col items-center justify-start w-[240px] xs:w-[270px] sm:w-[300px]">
                {/* Badge */}
                <div className="h-7 mb-3 inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-stone-200/80 dark:bg-neutral-800/80 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-ink dark:text-stone-300 shadow-sm">
                  <Film className="h-3.5 w-3.5 text-accent" />
                  <span>Media Video</span>
                </div>
                <div className="w-full rounded-3xl border border-stone-300/80 bg-stone-200/90 p-2.5 shadow-xl ring-1 ring-black/5 dark:border-neutral-800 dark:bg-neutral-900 dark:ring-white/10">
                  <div className="aspect-[9/14] w-full overflow-hidden rounded-2xl bg-black flex items-center justify-center">
                    <video
                      src={item.url}
                      controls
                      className="h-full w-full object-contain rounded-2xl"
                    />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Pagination Indicator Dots */}
      {mediaItems.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {mediaItems.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                if (!scrollRef.current) return;
                const scrollAmount = scrollRef.current.clientWidth * 0.75;
                scrollRef.current.scrollTo({
                  left: i * scrollAmount,
                  behavior: "smooth",
                });
              }}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                activeIndex === i
                  ? "w-6 bg-accent"
                  : "w-2 bg-ink/20 hover:bg-ink/40 dark:bg-white/20 dark:hover:bg-white/40"
              )}
              aria-label={`Video ${i + 1}`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
