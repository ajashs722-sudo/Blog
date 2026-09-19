import { useState } from "react";
import {
  Link2,
  Check,
  Share2,
  Send,
  MessageCircle,
} from "lucide-react";

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

interface ShareButtonsProps {
  title: string;
  url?: string;
  className?: string;
}

export function ShareButtons({
  title,
  url,
  className = "",
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    if (url) return url;
    if (typeof window !== "undefined") {
      return window.location.href;
    }
    return "https://blog.aluvantis.uz";
  };

  const currentUrl = getShareUrl();

  const handleTelegramShare = () => {
    // Telegram share with clean URL and title
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
      currentUrl
    )}&text=${encodeURIComponent(title)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const handleWhatsAppShare = () => {
    // WhatsApp share with clean text and URL
    const text = `${title} — ${currentUrl}`;
    const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const handleTwitterShare = () => {
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      title
    )}&url=${encodeURIComponent(currentUrl)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const handleLinkedInShare = () => {
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      currentUrl
    )}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = currentUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-light mr-1">
        <Share2 className="h-3.5 w-3.5 text-accent" />
        <span>Share</span>
      </div>

      {/* Telegram */}
      <button
        type="button"
        onClick={handleTelegramShare}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-3 py-1.5 text-xs font-medium text-ink-light transition-all hover:border-ink hover:text-ink hover:bg-ink/5 focus:outline-none"
        title="Share to Telegram"
        aria-label="Share to Telegram"
      >
        <Send className="h-3.5 w-3.5 text-[#24A1DE]" />
        <span>Telegram</span>
      </button>

      {/* WhatsApp */}
      <button
        type="button"
        onClick={handleWhatsAppShare}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-3 py-1.5 text-xs font-medium text-ink-light transition-all hover:border-ink hover:text-ink hover:bg-ink/5 focus:outline-none"
        title="Share to WhatsApp"
        aria-label="Share to WhatsApp"
      >
        <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
        <span>WhatsApp</span>
      </button>

      {/* Twitter / X */}
      <button
        type="button"
        onClick={handleTwitterShare}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-3 py-1.5 text-xs font-medium text-ink-light transition-all hover:border-ink hover:text-ink hover:bg-ink/5 focus:outline-none"
        title="Share on Twitter"
        aria-label="Share on Twitter"
      >
        <TwitterIcon className="h-3.5 w-3.5" />
        <span>Twitter</span>
      </button>

      {/* LinkedIn */}
      <button
        type="button"
        onClick={handleLinkedInShare}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-3 py-1.5 text-xs font-medium text-ink-light transition-all hover:border-ink hover:text-ink hover:bg-ink/5 focus:outline-none"
        title="Share on LinkedIn"
        aria-label="Share on LinkedIn"
      >
        <LinkedinIcon className="h-3.5 w-3.5 text-[#0A66C2]" />
        <span>LinkedIn</span>
      </button>

      {/* Copy Link */}
      <button
        type="button"
        onClick={handleCopyLink}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all focus:outline-none ${
          copied
            ? "border-accent bg-accent/15 text-accent font-semibold"
            : "border-ink/10 bg-paper text-ink-light hover:border-ink hover:text-ink hover:bg-ink/5"
        }`}
        title="Copy link"
        aria-label="Copy link"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-accent" />
            <span>Link Copied</span>
          </>
        ) : (
          <>
            <Link2 className="h-3.5 w-3.5" />
            <span>Copy Link</span>
          </>
        )}
      </button>
    </div>
  );
}
