import { Link } from "react-router-dom";
import { motion } from "motion/react";
import type { Article } from "../data/articles";
import { cn } from "../lib/utils";
import { FadeImage } from "./FadeImage";

interface ArticleCardProps {
  article: Article;
  featured?: boolean;
  index: number;
}

export function ArticleCard({
  article,
  featured = false,
  index,
}: ArticleCardProps) {
  return (
    <motion.article 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: Math.min(index * 0.08, 0.4), ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group flex flex-col gap-6 w-full max-w-full overflow-hidden break-words relative p-4 hover:bg-ink/[0.03] rounded-2xl transition-all duration-300",
        featured ? "md:flex-row md:items-center md:gap-12" : ""
      )}
    >
      <div 
        className={cn(
          "overflow-hidden rounded-lg bg-ink/5 shrink-0",
          featured ? "aspect-[16/9] md:aspect-[4/3] md:w-3/5" : "aspect-[4/3] w-full"
        )}
      >
        <FadeImage 
          src={article.coverImage} 
          alt={article.title} 
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover group-hover:scale-103 transition-transform duration-500"
          loading="lazy"
        />
      </div>
      
      <div className={cn(
        "flex flex-col min-w-0 flex-1 overflow-hidden",
        featured ? "md:w-2/5" : ""
      )}>
        <div className="mb-3 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-ink-light flex-wrap">
          <span>{article.date}</span>
        </div>
        
        <Link to={`/post/${article.slug}`} className="group-hover:text-accent transition-colors block overflow-hidden">
          <h2 className={cn(
            "font-serif leading-tight text-ink break-words break-all [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-[''] after:z-10",
            featured ? "text-3xl md:text-5xl mb-3" : "text-2xl mb-2.5"
          )}>
            {article.title}
          </h2>
        </Link>
        
        <p className={cn(
          "text-ink-light leading-relaxed break-words break-all [overflow-wrap:anywhere] line-clamp-2",
          featured ? "text-lg mb-6" : "text-sm mb-4"
        )}>
          {article.excerpt}
        </p>
        
        <div className="mt-auto flex items-center gap-3 pt-2">
          <FadeImage 
            src={article.author.avatar} 
            alt={article.author.name}
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full object-cover"
          />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-ink">{article.author.name}</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

