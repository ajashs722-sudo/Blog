import { motion, useScroll, useSpring } from "motion/react";

interface ReadingProgressBarProps {
  className?: string;
}

export function ReadingProgressBar({ className = "" }: ReadingProgressBarProps) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 24,
    restDelta: 0.001,
  });

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-50 h-[3px] pointer-events-none overflow-hidden bg-ink/5 ${className}`}
      aria-hidden="true"
    >
      <motion.div
        className="h-full w-full bg-accent origin-left shadow-[0_1px_8px_rgba(217,108,74,0.8)]"
        style={{ scaleX }}
      />
    </div>
  );
}

