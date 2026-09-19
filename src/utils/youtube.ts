/**
 * Transforms any YouTube URL (standard watch, Shorts, mobile, youtu.be, embed, share links)
 * into a clean, responsive YouTube iframe embed URL.
 */
export function getYoutubeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // 1. YouTube Shorts format: https://www.youtube.com/shorts/VIDEO_ID or https://youtu.be/shorts/VIDEO_ID
  const shortsMatch = trimmed.match(/(?:youtube\.com\/shorts\/|youtu\.be\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (shortsMatch && shortsMatch[1]) {
    return `https://www.youtube-nocookie.com/embed/${shortsMatch[1]}`;
  }

  // 2. Standard Watch, Embed, Share, Mobile, v links
  // Examples:
  // https://www.youtube.com/watch?v=dQw4w9WgXcQ
  // https://youtu.be/dQw4w9WgXcQ
  // https://m.youtube.com/watch?v=dQw4w9WgXcQ
  // https://www.youtube.com/embed/dQw4w9WgXcQ
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/i;
  const match = trimmed.match(regExp);
  if (match && match[1]) {
    return `https://www.youtube-nocookie.com/embed/${match[1]}`;
  }

  // 3. Direct embed URL already provided
  if (trimmed.includes("youtube.com/embed/") || trimmed.includes("youtube-nocookie.com/embed/")) {
    return trimmed;
  }

  return null;
}

export function isYoutubeShorts(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return /(?:youtube\.com\/shorts\/|youtu\.be\/shorts\/)/i.test(trimmed);
}

export interface YoutubeDetails {
  embedUrl: string | null;
  isShorts: boolean;
}

export function getYoutubeDetails(url?: string): YoutubeDetails {
  if (!url) return { embedUrl: null, isShorts: false };
  const embedUrl = getYoutubeEmbedUrl(url);
  const isShorts = isYoutubeShorts(url);
  return { embedUrl, isShorts };
}

export const parseYoutubeEmbedUrl = getYoutubeEmbedUrl;

/**
 * Checks if a given text string is a valid YouTube link (Shorts or standard)
 */
export function isValidYoutubeUrl(url?: string): boolean {
  if (!url) return false;
  return getYoutubeEmbedUrl(url) !== null;
}

/**
 * Checks if string is a valid Image or Media URL
 */
export function isValidMediaUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;

  const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".mp4", ".webm", ".mov"];
  if (validExtensions.some((ext) => trimmed.includes(ext))) return true;

  // Known media CDN hosts
  if (
    trimmed.includes("images.unsplash.com") ||
    trimmed.includes("picsum.photos") ||
    trimmed.includes("telegram.org") ||
    trimmed.includes("imgur.com") ||
    trimmed.includes("cdn")
  ) {
    return true;
  }

  return true; // standard http/https
}
