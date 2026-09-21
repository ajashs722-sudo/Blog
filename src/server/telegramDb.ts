import fs from "node:fs";
import path from "node:path";
import { articles, Article, defaultAuthor } from "../data/articles";
import { parseYoutubeEmbedUrl, isValidYoutubeUrl } from "../utils/youtube";
import { transferTelegramFileToR2 } from "./r2";

export interface BlogPostData {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  youtubeUrl?: string;
  videoUrl?: string;
  mediaGallery?: string[];
  quote?: { text: string; author?: string };
  date: string;
  readTime: string;
  tags: string[];
  author: {
    name: string;
    avatar: string;
    bio: string;
  };
  telegramMessageId?: number;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SubscriberData {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  subscribedAt: string;
  telegramMessageId?: number;
}

export function getBotToken(): string {
  return (process.env.TELEGRAM_BOT_TOKEN || "").trim();
}
export function getAdminId(): string {
  return (process.env.TELEGRAM_ADMIN_ID || "").trim();
}
export function getRawGroupId(): string {
  return (process.env.TELEGRAM_GROUP_ID || "").trim();
}
export function getAppUrl(): string {
  const url = (process.env.APP_URL || "https://blog.aluvantis.uz").trim();
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

const STORAGE_FILE_PATH = path.resolve(process.cwd(), "data_posts.json");

// Discovered group IDs set
const discoveredGroupIds = new Set<string | number>();

// Resolve group chat ID format for Telegram API (-100... or -...)
export function getGroupChatIds(): (string | number)[] {
  const rawId = getRawGroupId();
  const cleanId = rawId.replace(/^-100/, "").replace(/^-/, "");
  const ids: (string | number)[] = [
    `-100${cleanId}`,
    Number(`-100${cleanId}`),
    `-${cleanId}`,
    Number(`-${cleanId}`),
    rawId,
    Number(rawId),
  ];

  discoveredGroupIds.forEach((id) => {
    if (!ids.includes(id)) {
      ids.push(id);
    }
  });

  return ids;
}

export function getPrimaryGroupId(): string | number {
  const rawId = getRawGroupId();
  const cleanId = rawId.replace(/^-100/, "").replace(/^-/, "");
  return `-100${cleanId}`;
}

// Cloudflare KV Namespace reference for edge persistence across serverless isolates
let currentKvNamespace: any = null;

// In-memory store
let postsStore: BlogPostData[] = [];
let subscribersStore: Map<string, SubscriberData> = new Map();

export function setKvBinding(kv: any) {
  if (kv) currentKvNamespace = kv;
}

// Save state to KV and disk file
export async function saveToDiskStore() {
  const data = {
    posts: postsStore,
    subscribers: Array.from(subscribersStore.values()),
    discoveredGroupIds: Array.from(discoveredGroupIds),
  };

  // 1. Persist to Cloudflare KV for global edge sync
  if (currentKvNamespace) {
    try {
      await currentKvNamespace.put("data_posts", JSON.stringify(data));
      console.log("[KV Store] Successfully persisted blog database to Cloudflare KV!");
    } catch (e) {
      console.error("[KV Store] Error writing storage to Cloudflare KV:", e);
    }
  }

  // 2. Also try writing to local disk if fs is available
  try {
    if (typeof fs !== "undefined" && fs && typeof fs.writeFileSync === "function") {
      fs.writeFileSync(STORAGE_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
    }
  } catch (e) {
    // Expected on read-only serverless worker disk
  }
}

// Load state from KV or disk file
export async function loadFromDiskStore() {
  let loaded = false;

  // 1. Try reading from Cloudflare KV first
  if (currentKvNamespace) {
    try {
      const raw = await currentKvNamespace.get("data_posts");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.posts) && parsed.posts.length > 0) {
          postsStore = parsed.posts;
          loaded = true;
        }
        if (Array.isArray(parsed.subscribers)) {
          subscribersStore.clear();
          parsed.subscribers.forEach((s: SubscriberData) => {
            if (s.telegramId) subscribersStore.set(String(s.telegramId), s);
          });
        }
        if (Array.isArray(parsed.discoveredGroupIds)) {
          parsed.discoveredGroupIds.forEach((gid: string | number) => discoveredGroupIds.add(gid));
        }
      }
    } catch (e) {
      console.error("[KV Store] Error reading storage from Cloudflare KV:", e);
    }
  }

  // 2. Fallback: try reading from local disk if not loaded from KV
  if (!loaded) {
    try {
      if (typeof fs !== "undefined" && fs && typeof fs.existsSync === "function" && fs.existsSync(STORAGE_FILE_PATH)) {
        const raw = fs.readFileSync(STORAGE_FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.posts) && parsed.posts.length > 0) {
          postsStore = parsed.posts;
          loaded = true;
        }
        if (Array.isArray(parsed.subscribers)) {
          parsed.subscribers.forEach((s: SubscriberData) => {
            if (s.telegramId) subscribersStore.set(String(s.telegramId), s);
          });
        }
        if (Array.isArray(parsed.discoveredGroupIds)) {
          parsed.discoveredGroupIds.forEach((gid: string | number) => discoveredGroupIds.add(gid));
        }
      }
    } catch (e) {}
  }

  // 3. Initial seed if database is still empty
  if (!loaded || postsStore.length === 0) {
    postsStore = articles.map((a) => ({
      ...a,
      content: a.content || a.excerpt,
      createdAt: new Date().toISOString(),
    }));
    await saveToDiskStore();
  }
}

// Auto-migrate existing files to Cloudflare R2 on startup
export async function migrateExistingFilesToR2() {
  console.log("[R2 Migration] Checking if there are any existing posts using Telegram links that need migration to Cloudflare R2...");
  let migratedAny = false;

  for (const post of postsStore) {
    let changed = false;

    // Check coverImage
    if (post.coverImage && (post.coverImage.includes("api.telegram.org") || post.coverImage.includes("telegram-file"))) {
      console.log(`[R2 Migration] Migrating cover image for post "${post.title}"...`);
      const newUrl = await transferTelegramFileToR2(post.coverImage);
      if (newUrl && newUrl !== post.coverImage) {
        post.coverImage = newUrl;
        changed = true;
      }
    }

    // Check videoUrl
    if (post.videoUrl && (post.videoUrl.includes("api.telegram.org") || post.videoUrl.includes("telegram-file"))) {
      console.log(`[R2 Migration] Migrating video for post "${post.title}"...`);
      const newUrl = await transferTelegramFileToR2(post.videoUrl);
      if (newUrl && newUrl !== post.videoUrl) {
        post.videoUrl = newUrl;
        changed = true;
      }
    }

    // Check mediaGallery
    if (Array.isArray(post.mediaGallery)) {
      for (let i = 0; i < post.mediaGallery.length; i++) {
        const item = post.mediaGallery[i];
        if (item && (item.includes("api.telegram.org") || item.includes("telegram-file"))) {
          console.log(`[R2 Migration] Migrating media gallery item [${i}] for post "${post.title}"...`);
          const newUrl = await transferTelegramFileToR2(item);
          if (newUrl && newUrl !== item) {
            post.mediaGallery[i] = newUrl;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      post.updatedAt = new Date().toISOString();
      migratedAny = true;
      console.log(`[R2 Migration] Successfully migrated files for post: "${post.title}"`);
      
      // Update this post in the Telegram Group so the NoSQL db stays 100% updated and secure!
      try {
        console.log(`[R2 Migration] Syncing updated R2 links back to Telegram Group database for post ID: ${post.id}`);
        if (post.telegramMessageId) {
          const groupIds = getGroupChatIds();
          const encoded = encodePostForTelegram(post);
          const caption = encoded.length <= 1024 ? encoded : `📦 [BLOG_POST_JSON]\n${JSON.stringify({ ...post, content: post.content.substring(0, 300) })}`;
          
          for (const chatId of groupIds) {
            await callTelegramApi("editMessageCaption", {
              chat_id: chatId,
              message_id: post.telegramMessageId,
              caption: caption
            });
          }
        }
      } catch (err) {
        console.error(`[R2 Migration] Error updating Telegram group post message for ID: ${post.id}:`, err);
      }
    }
  }

  if (migratedAny) {
    saveToDiskStore();
    console.log("[R2 Migration] Finished migration and saved updated database to disk.");
  } else {
    console.log("[R2 Migration] No posts needed migration. Storage is fully up to date!");
  }
}

let isInitialized = false;
export async function ensureTelegramDbInitialized(kv?: any) {
  if (kv) setKvBinding(kv);
  if (isInitialized) return;
  isInitialized = true;
  await loadFromDiskStore();
}

// Multi-step creation session store for Admin
interface AdminWizardSession {
  step: "TITLE" | "EXCERPT" | "MEDIA" | "YOUTUBE" | "CONTENT" | "QUOTE";
  postData: Partial<BlogPostData>;
}
let adminWizardStore: Map<string, AdminWizardSession> = new Map();

interface AdminBroadcastSession {
  active: boolean;
}
let adminBroadcastStore: Map<string, AdminBroadcastSession> = new Map();

interface AdminEditSession {
  postId: string;
  fieldToEdit?: "TITLE" | "EXCERPT" | "MEDIA" | "YOUTUBE" | "CONTENT" | "QUOTE";
}
let adminEditStore: Map<string, AdminEditSession> = new Map();

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  field?: string;
}

export function isRealHumanText(text: string): boolean {
  const clean = (text || "").trim();
  if (!clean) return false;

  // 1. Unbroken word check (> 20 chars without space, unless URL)
  const words = clean.split(/\s+/);
  for (const word of words) {
    if (word.length > 20 && !word.startsWith("http://") && !word.startsWith("https://")) {
      return false;
    }
  }

  // 2. Consonant mashing check (5 or more consecutive consonants like "rbfnjfkt" or "Ejrbfnjfktititi")
  if (/[bcdfghjklmnpqrstvwxzбвгджзйклмнпрстфхцчшщ]{5,}/gi.test(clean)) {
    return false;
  }

  // 3. Repeating character spam ("aaaaa", "zzzzz")
  if (/(.)\1{4,}/i.test(clean)) {
    return false;
  }

  // 4. Must have vowels if length >= 4
  const vowels = clean.toLowerCase().match(/[aeiouo'g'yаеиоуэюя]/gi);
  if (clean.length >= 4 && (!vowels || vowels.length < 1)) {
    return false;
  }

  return true;
}

export function validateTitle(titleText: string): ValidationResult {
  const trimmed = (titleText || "").trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "Sarlavha (Title) bo'sh bo'lishi mumkin emas!",
      field: "title",
    };
  }

  if (trimmed.length < 5) {
    return {
      isValid: false,
      error: `Sarlavha juda qisqa (${trimmed.length} ta belgi). Sarlavha kamida 5 ta belgidan iborat bo'lishi shart!`,
      field: "title",
    };
  }

  if (trimmed.length > 120) {
    return {
      isValid: false,
      error: `Sarlavha juda uzun (${trimmed.length} ta belgi). Maksimal 120 ta belgi ruxsat etilgan!`,
      field: "title",
    };
  }

  // Check for real text structure
  if (!isRealHumanText(trimmed)) {
    return {
      isValid: false,
      error: "Sarlavha mazmunsiz yoki tasodifiy harflardan iborat ('Ejrbfnjfktititi', 'asdfghjkl' kabi belgilardan saqlaning).",
      field: "title",
    };
  }

  return { isValid: true };
}

export function validateExcerpt(excerptText: string): ValidationResult {
  const trimmed = (excerptText || "").trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "Qisqacha mazmun (Excerpt) bo'sh bo'lishi mumkin emas!",
      field: "excerpt",
    };
  }

  if (trimmed.length < 10) {
    return {
      isValid: false,
      error: `Qisqacha mazmun juda qisqa (${trimmed.length} ta belgi). Kamida 10 ta belgi yozilishi shart!`,
      field: "excerpt",
    };
  }

  if (trimmed.length > 300) {
    return {
      isValid: false,
      error: `Qisqacha mazmun juda uzun (${trimmed.length} ta belgi). Maksimal 300 ta belgi bo'lishi kerak!`,
      field: "excerpt",
    };
  }

  if (!isRealHumanText(trimmed)) {
    return {
      isValid: false,
      error: "Qisqacha mazmun mazmunsiz yoki tasodifiy harflardan iborat ('Ejrbfnjfktititi', 'Djdndndne' kabi belgilardan saqlaning).",
      field: "excerpt",
    };
  }

  return { isValid: true };
}

export function validateContent(contentText: string): ValidationResult {
  const trimmed = (contentText || "").trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "Maqola to'liq matni (Content) bo'sh bo'lishi mumkin emas!",
      field: "content",
    };
  }

  if (trimmed.length < 20) {
    return {
      isValid: false,
      error: `Maqola matni juda qisqa (${trimmed.length} ta belgi). Kamida 20 ta belgi bo'lishi kerak!`,
      field: "content",
    };
  }

  if (!isRealHumanText(trimmed)) {
    return {
      isValid: false,
      error: "Maqola matni mazmunsiz yoki tasodifiy harflardan iborat bo'lmasligi kerak.",
      field: "content",
    };
  }

  return { isValid: true };
}

// Helper to call Telegram API with timeout & error resilience
export async function callTelegramApi(method: string, body: Record<string, any>, options?: { timeoutMs?: number }) {
  const token = getBotToken();
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const timeoutMs = options?.timeoutMs || (method === "getUpdates" ? 25000 : 15000);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const data = await res.json();
    return data;
  } catch (err: any) {
    // Expected transient network/socket drops for long polling getUpdates
    if (method === "getUpdates") {
      return { ok: false, error: err?.message || String(err) };
    }
    console.error(`Telegram API Call Error [${method}]:`, err?.message || err);
    return { ok: false, error: String(err) };
  }
}

// Helper to get direct Telegram CDN File URL from file_id and upload to Cloudflare R2
export async function getTelegramFileUrl(fileId: string): Promise<string> {
  try {
    const res = await callTelegramApi("getFile", { file_id: fileId });
    if (res.ok && res.result?.file_path) {
      const token = getBotToken();
      const telegramUrl = `https://api.telegram.org/file/bot${token}/${res.result.file_path}`;
      console.log(`[R2 Sync] Transferring downloaded Telegram file ${fileId} to Cloudflare R2...`);
      const r2Url = await transferTelegramFileToR2(telegramUrl);
      if (r2Url) {
        console.log(`[R2 Sync] Success! File transferred to R2: ${r2Url}`);
        return r2Url;
      }
      return telegramUrl; // Fallback
    }
  } catch (e) {
    console.error("Error getting Telegram file path and transferring to R2:", e);
  }
  return "";
}

// Register Telegram Command Menu on Bot startup
export async function registerBotCommands() {
  const publicCommands = [
    { command: "start", description: "🚀 Bosh menyu / Botni ishga tushirish" },
    { command: "posts", description: "📚 Barcha maqolalar ro'yxati" },
    { command: "latest", description: "📰 Eng so'nggi yangi maqola" },
    { command: "search", description: "🔍 Maqolalar orasidan qidirish" },
    { command: "myid", description: "🆔 Mening Telegram ID raqamim" },
  ];

  const adminCommands = [
    { command: "start", description: "🚀 Bosh menyu / Botni ishga tushirish" },
    { command: "posts", description: "📚 Barcha maqolalar ro'yxati" },
    { command: "latest", description: "📰 Eng so'nggi yangi maqola" },
    { command: "search", description: "🔍 Maqolalar orasidan qidirish" },
    { command: "stats", description: "📊 Sistema va Bot statistikasi" },
    { command: "myid", description: "🆔 Mening ID va ma'lumotlarim" },
    { command: "admin", description: "👑 Admin Boshqaruv Paneli (Anvar)" },
    { command: "newpost", description: "➕ Step-by-Step Maqola yaratish" },
    { command: "subscribers", description: "👥 Obunachilar ro'yxati (Admin)" },
    { command: "broadcast", description: "📢 Obunachilarga e'lon tarqatish" },
  ];

  // 1. Set default commands for regular users
  await callTelegramApi("setMyCommands", { commands: publicCommands });

  // 2. Set admin-specific commands for Anvar (main admin)
  try {
    const adminId = getAdminId();
    if (adminId) {
      const adminChatId = parseInt(adminId, 10);
      if (!isNaN(adminChatId)) {
        await callTelegramApi("setMyCommands", {
          commands: adminCommands,
          scope: { type: "chat", chat_id: adminChatId }
        });
        console.log(`[Bot Commands] Successfully registered custom admin commands for Admin ID: ${adminChatId}`);
      }
    }
  } catch (err) {
    console.error("[Bot Commands] Error setting admin-scoped commands:", err);
  }
}

// Helper to check if a user is the Main Admin
export function isAdminUser(uId: string, cId: string): boolean {
  const cleanUid = String(uId || "").trim();
  const cleanCid = String(cId || "").trim();
  const targetAdmin = getAdminId();
  if (!targetAdmin) return false;
  return cleanUid === targetAdmin || cleanCid === targetAdmin;
}

// Generate Admin Reply Keyboard (Buttons right on screen)
export function getAdminReplyKeyboard() {
  return {
    keyboard: [
      [{ text: "➕ Yangi Maqola Yaratish (Step-by-Step)" }, { text: "📚 Barcha Maqolalar" }],
      [{ text: "📰 So'nggi Maqola" }, { text: "📊 Baza Statistikasi" }],
      [{ text: "👥 Obunachilar Ro'yxati" }, { text: "📢 Obunachilarga Xabar Yuborish" }],
      [{ text: "🆔 Mening ID" }, { text: "✏️ Tahrirlash / O'chirish" }]
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

// Generate Wizard Active Reply Keyboard with Cancel button
export function getWizardReplyKeyboard() {
  return {
    keyboard: [
      [{ text: "❌ Yaratishni Bekor Qilish" }]
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

// Generate Regular User Reply Keyboard
export function getUserReplyKeyboard() {
  return {
    keyboard: [
      [{ text: "📚 Barcha Maqolalar" }, { text: "📰 So'nggi Maqola" }],
      [{ text: "📊 Statistikalar" }, { text: "🌐 Veb-saytga O'tish" }],
      [{ text: "🆔 Mening Profilim" }]
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

// Format blog post for Telegram storage & beautiful human display in group
export function encodePostForTelegram(post: BlogPostData): string {
  const cleanJson = JSON.stringify(post);
  return `📌 *${post.title}*\n\n` +
    `${post.excerpt}\n\n` +
    `✍️ Muallif: ${post.author?.name || "Anvar"}\n` +
    `⏱️ ${post.readTime || "5 min"} · 📅 ${post.date}\n\n` +
    `🔗 [Veb-saytda o'qish](${getAppUrl()}/post/${post.slug})\n\n` +
    `📦 [BLOG_POST_JSON:${cleanJson}]`;
}

// Decode blog post from Telegram message text/caption
export function decodePostFromTelegram(text: string): BlogPostData | null {
  try {
    if (!text) return null;
    if (text.includes("[BLOG_POST_JSON:")) {
      const parts = text.split("[BLOG_POST_JSON:");
      if (parts[1]) {
        let jsonStr = parts[1].trim();
        if (jsonStr.endsWith("]")) jsonStr = jsonStr.slice(0, -1);
        return JSON.parse(jsonStr);
      }
    }
    if (text.includes("[BLOG_POST_JSON]")) {
      const jsonStr = text.split("[BLOG_POST_JSON]")[1]?.trim();
      if (jsonStr) return JSON.parse(jsonStr);
    }
    if (text.trim().startsWith("{") && text.trim().endsWith("}")) {
      const parsed = JSON.parse(text);
      if (parsed && parsed.id && parsed.title) {
        return parsed;
      }
    }
  } catch (e) {
    // Ignore invalid JSON
  }
  return null;
}

// Format subscriber for Telegram storage
export function encodeSubscriberForTelegram(sub: SubscriberData): string {
  return `👤 [SUBSCRIBER_JSON]\n${JSON.stringify(sub, null, 2)}`;
}

// Decode subscriber from Telegram message
export function decodeSubscriberFromTelegram(text: string): SubscriberData | null {
  try {
    if (!text) return null;
    if (text.includes("[SUBSCRIBER_JSON]")) {
      const jsonStr = text.split("[SUBSCRIBER_JSON]")[1]?.trim();
      if (jsonStr) return JSON.parse(jsonStr);
    }
  } catch (e) {
    // Ignore invalid JSON
  }
  return null;
}

// Post a new blog entry to the Telegram Group database
export async function createPostInTelegram(postInput: Partial<BlogPostData>): Promise<BlogPostData> {
  const id = postInput.id || `post_${Date.now()}`;
  const slug = postInput.slug || id.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const newPost: BlogPostData = {
    id,
    slug,
    title: postInput.title || "Untitled Article",
    excerpt: postInput.excerpt || "",
    content: postInput.content || postInput.excerpt || "",
    coverImage: postInput.coverImage || "/author.png",
    youtubeUrl: postInput.youtubeUrl || "",
    videoUrl: postInput.videoUrl || "",
    mediaGallery: postInput.mediaGallery || [],
    quote: postInput.quote,
    date: postInput.date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    readTime: postInput.readTime || "5 min read",
    tags: postInput.tags || ["General"],
    author: postInput.author || defaultAuthor,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const groupIds = getGroupChatIds();
  let messageSent = false;
  let telegramMsgId: number | undefined;

  for (const chatId of groupIds) {
    const encoded = encodePostForTelegram(newPost);
    let res;

    if (newPost.videoUrl && (newPost.videoUrl.startsWith("http") || newPost.videoUrl.startsWith("https"))) {
      res = await callTelegramApi("sendVideo", {
        chat_id: chatId,
        video: newPost.videoUrl,
        caption: encoded.length <= 1024 ? encoded : `📦 [BLOG_POST_JSON]\n${JSON.stringify({ ...newPost, content: newPost.content.substring(0, 300) })}`,
      });
    }

    if ((!res || !res.ok) && newPost.coverImage && (newPost.coverImage.startsWith("http") || newPost.coverImage.startsWith("https"))) {
      res = await callTelegramApi("sendPhoto", {
        chat_id: chatId,
        photo: newPost.coverImage,
        caption: encoded.length <= 1024 ? encoded : `📦 [BLOG_POST_JSON]\n${JSON.stringify({ ...newPost, content: newPost.content.substring(0, 300) })}`,
      });
    }

    if (!res || !res.ok) {
      res = await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: encoded,
      });
    }

    if (res && res.ok && res.result?.message_id) {
      telegramMsgId = res.result.message_id;
      newPost.telegramMessageId = telegramMsgId;
      messageSent = true;
      break;
    }
  }

  // Update in-memory store
  const existingIndex = postsStore.findIndex((p) => p.id === newPost.id || p.slug === newPost.slug);
  if (existingIndex >= 0) {
    postsStore[existingIndex] = newPost;
  } else {
    postsStore.unshift(newPost);
  }

  saveToDiskStore();

  // Automatically notify all subscribers about the new blog post!
  notifyAllSubscribers(newPost).catch((e) => console.error("Error notifying subscribers:", e));

  return newPost;
}

// Update existing blog post in Telegram group
export async function updatePostInTelegram(idOrSlug: string, updateData: Partial<BlogPostData>): Promise<BlogPostData | null> {
  const index = postsStore.findIndex((p) => p.id === idOrSlug || p.slug === idOrSlug);
  if (index === -1) return null;

  const updatedPost: BlogPostData = {
    ...postsStore[index],
    ...updateData,
    updatedAt: new Date().toISOString(),
  };

  postsStore[index] = updatedPost;
  saveToDiskStore();

  if (updatedPost.telegramMessageId) {
    const encoded = encodePostForTelegram(updatedPost);
    const caption = encoded.length <= 1024 ? encoded : `📦 [BLOG_POST_JSON]\n${JSON.stringify({ ...updatedPost, content: updatedPost.content.substring(0, 300) })}`;
    const groupIds = getGroupChatIds();

    for (const chatId of groupIds) {
      let mediaUpdated = false;

      // If media (coverImage or videoUrl) was explicitly updated in this patch
      if (updateData.coverImage || updateData.videoUrl) {
        let mediaObj: any = null;
        if (updatedPost.videoUrl && (updatedPost.videoUrl.startsWith("http") || updatedPost.videoUrl.startsWith("https"))) {
          mediaObj = {
            type: "video",
            media: updatedPost.videoUrl,
            caption: caption
          };
        } else if (updatedPost.coverImage && (updatedPost.coverImage.startsWith("http") || updatedPost.coverImage.startsWith("https"))) {
          mediaObj = {
            type: "photo",
            media: updatedPost.coverImage,
            caption: caption
          };
        }

        if (mediaObj) {
          const res = await callTelegramApi("editMessageMedia", {
            chat_id: chatId,
            message_id: updatedPost.telegramMessageId,
            media: mediaObj
          });
          if (res && res.ok) {
            mediaUpdated = true;
          }
        }
      }

      // If media wasn't updated or editMessageMedia failed, edit just the caption or text
      if (!mediaUpdated) {
        const res = await callTelegramApi("editMessageCaption", {
          chat_id: chatId,
          message_id: updatedPost.telegramMessageId,
          caption: caption,
        });

        if (!res.ok) {
          await callTelegramApi("editMessageText", {
            chat_id: chatId,
            message_id: updatedPost.telegramMessageId,
            text: encoded,
          });
        }
      }
    }
  }

  return updatedPost;
}

// Delete (Soft Delete) post from Telegram group database
export async function deletePostFromTelegram(idOrSlug: string): Promise<boolean> {
  const index = postsStore.findIndex((p) => p.id === idOrSlug || p.slug === idOrSlug);
  if (index === -1) return false;

  const postToDelete = postsStore[index];
  postToDelete.isDeleted = true;
  postToDelete.updatedAt = new Date().toISOString();
  
  postsStore[index] = postToDelete;
  saveToDiskStore();

  // Soft delete update in Telegram Group Database message
  if (postToDelete.telegramMessageId) {
    const encoded = encodePostForTelegram(postToDelete);
    const groupIds = getGroupChatIds();
    for (const chatId of groupIds) {
      const res = await callTelegramApi("editMessageCaption", {
        chat_id: chatId,
        message_id: postToDelete.telegramMessageId,
        caption: encoded.length <= 1024 ? encoded : `📦 [BLOG_POST_JSON]\n${JSON.stringify({ id: postToDelete.id, isDeleted: true, title: postToDelete.title })}`,
      });

      if (!res.ok) {
        await callTelegramApi("editMessageText", {
          chat_id: chatId,
          message_id: postToDelete.telegramMessageId,
          text: `🗑 [DELETED_POST]\nID: ${postToDelete.id}\nTitle: ${postToDelete.title}\nisDeleted: true`,
        });
      }
    }
  }

  return true;
}

// Get all posts (filters out soft-deleted posts by default)
export function getAllPostsFromStore(includeDeleted = false): BlogPostData[] {
  if (includeDeleted) {
    return postsStore;
  }
  return postsStore.filter((p) => !p.isDeleted);
}

export function getPostBySlugFromStore(slugOrId: string, includeDeleted = false): BlogPostData | undefined {
  if (!slugOrId) return undefined;
  let decoded = slugOrId;
  try {
    decoded = decodeURIComponent(slugOrId);
  } catch (e) {}

  const target = decoded.trim().toLowerCase();
  return postsStore.find((p) => {
    if (!includeDeleted && p.isDeleted) return false;
    const pSlug = (p.slug || "").trim().toLowerCase();
    const pId = String(p.id || "").trim().toLowerCase();
    let pSlugDecoded = pSlug;
    try {
      pSlugDecoded = decodeURIComponent(pSlug);
    } catch (e) {}
    return pSlug === target || pSlugDecoded === target || pId === target;
  });
}

// Helper to generate a paginated post list message and inline keyboard
export function getPaginatedPostsKeyboard(page: number, isAdmin: boolean) {
  const PAGE_SIZE = 4; // Paginate with 4 posts as requested by the user
  const activePosts = getAllPostsFromStore();
  const totalPosts = activePosts.length;
  const totalPages = Math.ceil(totalPosts / PAGE_SIZE);

  let text = "";
  if (totalPosts === 0) {
    text = "📚 *Maqolalar Ro'yxati*:\n\n_Hozircha guruh bazasida chop etilgan maqolalar yo'q. Step-by-step orqali maqola yarating!_";
    return { text, reply_markup: { inline_keyboard: [] } };
  }

  // Safe page guard
  let activePage = page;
  if (activePage < 0) activePage = 0;
  if (activePage >= totalPages) activePage = totalPages - 1;

  const startIdx = activePage * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, totalPosts);
  const pagePosts = activePosts.slice(startIdx, endIdx);

  text = `📚 *Maqolalar Ro'yxati (Sahifa ${activePage + 1}/${totalPages})*:\n\n`;

  const inline_keyboard: any[] = [];

  pagePosts.forEach((post, index) => {
    const globalIndex = startIdx + index + 1;
    text += `*${globalIndex}. ${post.title}*\nID: \`${post.id}\` | Sana: ${post.date}\n\n`;

    const row: any[] = [
      { text: `📖 O'qish (${globalIndex})`, url: `${getAppUrl()}/post/${post.slug}` }
    ];
    if (isAdmin) {
      row.push({ text: `✏️ Tahrirlash`, callback_data: `edit_post_sel_${post.id}` });
      row.push({ text: `🗑️ O'chirish`, callback_data: `delete_post_${post.id}` });
    }
    inline_keyboard.push(row);
  });

  // Navigation buttons row
  const navRow: any[] = [];
  if (activePage > 0) {
    navRow.push({ text: "⬅️ Oldingi", callback_data: `posts_page_${activePage - 1}` });
  }
  if (totalPages > 1) {
    navRow.push({ text: `${activePage + 1}/${totalPages}`, callback_data: `posts_page_current` });
  }
  if (activePage < totalPages - 1) {
    navRow.push({ text: "➡️ Keyingi", callback_data: `posts_page_${activePage + 1}` });
  }

  if (navRow.length > 0) {
    inline_keyboard.push(navRow);
  }

  return { text, reply_markup: { inline_keyboard } };
}

// Helper to generate post edit fields menu and inline keyboard
export function getPostEditFieldsKeyboard(postId: string) {
  const post = getPostBySlugFromStore(postId);
  if (!post) {
    return {
      text: "⚠️ <b>Maqola topilmadi.</b>",
      reply_markup: { inline_keyboard: [] }
    };
  }

  const quoteText = post.quote && typeof post.quote === 'object' ? post.quote.text : "Yo'q";

  const text = `✏️ <b>Tahrirlash</b>: "${post.title}"\n\n` +
    `Quyidagi maydonlardan birini tanlang va yangi qiymatni yuboring:\n` +
    `• 📌 <b>Sarlavha</b>: ${post.title}\n` +
    `• 📝 <b>Qisqacha mazmun</b>: ${post.excerpt}\n` +
    `• 🎥 <b>YouTube Link</b>: ${post.youtubeUrl || "Yo'q"}\n` +
    `• 💬 <b>Iqtibos</b>: ${quoteText}\n` +
    `• 🖼️ <b>Rasm/Video</b>: <a href="${post.coverImage || ''}">Ko'rish</a>`;

  const inline_keyboard = [
    [
      { text: "📌 Sarlavha (Title)", callback_data: `edit_field_TITLE_${postId}` },
      { text: "📝 Qisqacha Mazmun", callback_data: `edit_field_EXCERPT_${postId}` }
    ],
    [
      { text: "📖 Maqola Matni", callback_data: `edit_field_CONTENT_${postId}` },
      { text: "🖼️ Rasm / Muqova", callback_data: `edit_field_MEDIA_${postId}` }
    ],
    [
      { text: "🎥 YouTube Link", callback_data: `edit_field_YOUTUBE_${postId}` },
      { text: "💬 Iqtibos (Quote)", callback_data: `edit_field_QUOTE_${postId}` }
    ],
    [
      { text: "⬅️ Orqaga (Bekor Qilish)", callback_data: `edit_field_CANCEL_${postId}` }
    ]
  ];

  return { text, reply_markup: { inline_keyboard } };
}

// Add/register subscriber
export async function addSubscriber(sub: Partial<SubscriberData>): Promise<SubscriberData> {
  const telegramId = String(sub.telegramId || "");
  if (!telegramId) throw new Error("Telegram ID is required for subscriber registration.");

  const subscriber: SubscriberData = {
    telegramId,
    username: sub.username || "",
    firstName: sub.firstName || "",
    lastName: sub.lastName || "",
    subscribedAt: new Date().toISOString(),
  };

  subscribersStore.set(telegramId, subscriber);
  saveToDiskStore();

  // Store in Telegram group database
  const groupIds = getGroupChatIds();
  const encoded = encodeSubscriberForTelegram(subscriber);

  for (const chatId of groupIds) {
    const res = await callTelegramApi("sendMessage", {
      chat_id: chatId,
      text: encoded,
    });
    if (res.ok && res.result?.message_id) {
      subscriber.telegramMessageId = res.result.message_id;
      break;
    }
  }

  return subscriber;
}

// Get subscribers list
export function getSubscribersList(): SubscriberData[] {
  return Array.from(subscribersStore.values());
}

// Broadcast new blog notification to all subscribers
export async function notifyAllSubscribers(post: BlogPostData) {
  const subscribers = getSubscribersList();
  
  const adminId = getAdminId();
  if (adminId) allTargetIds.add(String(adminId));
  subscribers.forEach((s) => allTargetIds.add(String(s.telegramId)));

  const messageText = `📢 *YANGI BLOG MAQOLASI CHOP ETILDI!* 📰\n\n` +
    `*${post.title}*\n\n` +
    `${post.excerpt}\n\n` +
    `✍️ Muallif: ${post.author.name}\n` +
    `⏱️ ${post.readTime} · 📅 ${post.date}\n\n` +
    `🔗 Blogimizda to'liq o'qing!`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "📖 Veb-saytda o'qish", url: `${getAppUrl()}/post/${post.slug}` }
      ]
    ]
  };

  for (const chatId of allTargetIds) {
    let sent = false;
    if (post.videoUrl && (post.videoUrl.startsWith("http") || post.videoUrl.startsWith("https"))) {
      const res = await callTelegramApi("sendVideo", {
        chat_id: chatId,
        video: post.videoUrl,
        caption: messageText,
        parse_mode: "Markdown",
        reply_markup: inlineKeyboard,
      });
      if (res && res.ok) sent = true;
    }

    if (!sent && post.coverImage && (post.coverImage.startsWith("http") || post.coverImage.startsWith("https"))) {
      const res = await callTelegramApi("sendPhoto", {
        chat_id: chatId,
        photo: post.coverImage,
        caption: messageText,
        parse_mode: "Markdown",
        reply_markup: inlineKeyboard,
      });
      if (res && res.ok) sent = true;
    }

    if (!sent) {
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: messageText,
        parse_mode: "Markdown",
        reply_markup: inlineKeyboard,
      });
    }
  }
}

// System Stats Summary
export function getSystemStats() {
  return {
    totalPosts: postsStore.length,
    totalSubscribers: subscribersStore.size,
    telegramGroupId: getRawGroupId(),
    adminId: getAdminId(),
    discoveredGroups: Array.from(discoveredGroupIds),
    status: "Active & Connected to Telegram Group Storage",
  };
}

// Process Webhook & Polling updates from Telegram
export async function handleTelegramWebhookUpdate(update: any) {
  if (!update) return;

  // Auto-discover group chat IDs when update comes from a group or supergroup
  const msgChat = update.message?.chat || update.channel_post?.chat || update.my_chat_member?.chat || update.callback_query?.message?.chat;
  if (msgChat && msgChat.id) {
    const cType = msgChat.type || "";
    if (cType === "group" || cType === "supergroup" || cType === "channel" || String(msgChat.id).startsWith("-")) {
      if (!discoveredGroupIds.has(msgChat.id)) {
        discoveredGroupIds.add(msgChat.id);
        saveToDiskStore();
      }
    }
  }

  // 1. Handle Inline Button Clicks (callback_query)
  if (update.callback_query) {
    const cb = update.callback_query;
    const cbData = cb.data || "";
    const cbUserId = String(cb.from?.id || "");
    const cbChatId = String(cb.message?.chat?.id || "");
    const cbMessageId = cb.message?.message_id;

    if (cbData.startsWith("posts_page_")) {
      const pageStr = cbData.replace("posts_page_", "");
      if (pageStr === "current") {
        await callTelegramApi("answerCallbackQuery", { callback_query_id: cb.id });
        return;
      }
      const pageNum = parseInt(pageStr, 10);
      if (!isNaN(pageNum)) {
        const isAdmin = isAdminUser(cbUserId, cbChatId);
        const { text: pText, reply_markup: pMarkup } = getPaginatedPostsKeyboard(pageNum, isAdmin);
        
        await callTelegramApi("editMessageText", {
          chat_id: cbChatId,
          message_id: cbMessageId,
          text: pText,
          parse_mode: "Markdown",
          reply_markup: pMarkup,
        });
      }
      await callTelegramApi("answerCallbackQuery", { callback_query_id: cb.id });
      return;
    }

    if (cbData.startsWith("delete_post_")) {
      const postId = cbData.replace("delete_post_", "");
      const isAdmin = isAdminUser(cbUserId, cbChatId);

      if (!isAdmin) {
        await callTelegramApi("answerCallbackQuery", {
          callback_query_id: cb.id,
          text: "⛔ Faqat Asosiy Admin (Anvar) maqolalarni o'chira oladi!",
          show_alert: true,
        });
        return;
      }

      const deleted = await deletePostFromTelegram(postId);
      await callTelegramApi("answerCallbackQuery", {
        callback_query_id: cb.id,
        text: deleted ? "✅ Maqola muvaffaqiyatli o'chirildi!" : "❌ Maqola topilmadi.",
        show_alert: true,
      });

      if (deleted && cbChatId && cbMessageId) {
        const msgText = cb.message?.text || cb.message?.caption || "";
        if (msgText.includes("Maqolalar Ro'yxati")) {
          // Refresh the paginated list in-place
          let currentPage = 0;
          const pageMatch = msgText.match(/Sahifa\s+(\d+)/i);
          if (pageMatch) {
            currentPage = parseInt(pageMatch[1], 10) - 1;
          }
          const { text: updatedText, reply_markup: updatedMarkup } = getPaginatedPostsKeyboard(currentPage, isAdmin);
          await callTelegramApi("editMessageText", {
            chat_id: cbChatId,
            message_id: cbMessageId,
            text: updatedText,
            parse_mode: "Markdown",
            reply_markup: updatedMarkup,
          });
        } else {
          // Standalone post view, delete the post message
          await callTelegramApi("deleteMessage", {
            chat_id: cbChatId,
            message_id: cbMessageId,
          });
        }
      }
    }

    if (cbData.startsWith("edit_post_sel_")) {
      const postId = cbData.replace("edit_post_sel_", "");
      const isAdmin = isAdminUser(cbUserId, cbChatId);
      if (!isAdmin) {
        await callTelegramApi("answerCallbackQuery", {
          callback_query_id: cb.id,
          text: "⛔ Faqat Asosiy Admin (Anvar) tahrirlashi mumkin!",
          show_alert: true,
        });
        return;
      }

      adminEditStore.set(cbUserId, { postId });
      const { text: eText, reply_markup: eMarkup } = getPostEditFieldsKeyboard(postId);
      await callTelegramApi("editMessageText", {
        chat_id: cbChatId,
        message_id: cbMessageId,
        text: eText,
        parse_mode: "HTML",
        reply_markup: eMarkup,
      });
      await callTelegramApi("answerCallbackQuery", { callback_query_id: cb.id });
      return;
    }

    if (cbData.startsWith("edit_field_")) {
      const parts = cbData.replace("edit_field_", "").split("_");
      const field = parts[0]; // e.g. TITLE, EXCERPT, etc. or CANCEL, BACK
      const postId = parts.slice(1).join("_");
      const isAdmin = isAdminUser(cbUserId, cbChatId);

      if (!isAdmin) {
        await callTelegramApi("answerCallbackQuery", {
          callback_query_id: cb.id,
          text: "⛔ Faqat Asosiy Admin (Anvar) tahrirlashi mumkin!",
          show_alert: true,
        });
        return;
      }

      if (field === "CANCEL") {
        adminEditStore.delete(cbUserId);
        const { text: pText, reply_markup: pMarkup } = getPaginatedPostsKeyboard(0, isAdmin);
        await callTelegramApi("editMessageText", {
          chat_id: cbChatId,
          message_id: cbMessageId,
          text: pText,
          parse_mode: "Markdown",
          reply_markup: pMarkup,
        });
      } else if (field === "BACK") {
        adminEditStore.set(cbUserId, { postId }); // Clear fieldToEdit
        const { text: eText, reply_markup: eMarkup } = getPostEditFieldsKeyboard(postId);
        await callTelegramApi("editMessageText", {
          chat_id: cbChatId,
          message_id: cbMessageId,
          text: eText,
          parse_mode: "HTML",
          reply_markup: eMarkup,
        });
      } else {
        adminEditStore.set(cbUserId, { postId, fieldToEdit: field as any });
        
        let instructions = "";
        if (field === "TITLE") {
          instructions = "✍️ <b>Yangi Sarlavhani (Title) yozib yuboring</b>:\n• Uzunlik: <b>5 tadan 120 tagacha belgi</b> bo'lishi shart.";
        } else if (field === "EXCERPT") {
          instructions = "✍️ <b>Yangi Qisqacha Mazmunni (Excerpt) yozib yuboring</b>:\n• Uzunlik: <b>10 tadan 300 tagacha belgi</b> bo'lishi shart.";
        } else if (field === "CONTENT") {
          instructions = "📖 <b>Yangi Maqola Matnini (Content) yozib yuboring</b>:\n• Kamida <b>50 ta belgi</b> bo'lsin.\n• HTML va formatlash elementlaridan foydalanish mumkin.";
        } else if (field === "MEDIA") {
          instructions = "🖼️ <b>Yangi Muqova Rasmini (Cover Image) yuboring</b>:\n• Ushbu chatga rasm yoki video fayl yuklang\n• Yoki to'g'ridan-to'g'ri rasm havolasini yozib yuboring (<code>https://...</code>)\n• Yoki standart rasmga almashtirish uchun <b>'default'</b> deb yozing.";
        } else if (field === "YOUTUBE") {
          instructions = "🎥 <b>Yangi YouTube Video havolasini yozib yuboring</b>:\n• Masalan: <code>https://www.youtube.com/watch?v=...</code>\n• YouTube videoni o'chirish uchun <b>'skip'</b> yoki <b>'none'</b> deb yozing.";
        } else if (field === "QUOTE") {
          instructions = "💬 <b>Yangi Iqtibosni (Quote) yozib yuboring</b>:\n• Maqolada chiroyli iqtibos bo'lib ko'rinadi.\n• Iqtibosni o'chirish uchun <b>'skip'</b> yoki <b>'none'</b> deb yozing.";
        }

        instructions += "\n\n🛑 <b>Tahrirlashni bekor qilish uchun quyidagi '🔙 Orqaga' tugmasini bosing:</b>";

        await callTelegramApi("editMessageText", {
          chat_id: cbChatId,
          message_id: cbMessageId,
          text: instructions,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Orqaga (Bekor Qilish)", callback_data: `edit_field_BACK_${postId}` }]
            ]
          }
        });
      }

      await callTelegramApi("answerCallbackQuery", { callback_query_id: cb.id });
      return;
    }
    return;
  }

  // 2. Handle Messages (Text, Photos, Videos)
  const message = update.message || update.edited_message || update.channel_post;
  if (!message) return;

  const rawText = (message.text || message.caption || "").trim();
  const chatId = String(message.chat.id);
  const userId = String(message.from?.id || "");
  const username = message.from?.username || "";
  const firstName = message.from?.first_name || "";
  const lastName = message.from?.last_name || "";
  const isAdmin = isAdminUser(userId, chatId);

  // Check if message contains JSON data from group storage
  const decodedPost = decodePostFromTelegram(rawText);
  if (decodedPost) {
    decodedPost.telegramMessageId = message.message_id;
    const existingIdx = postsStore.findIndex((p) => p.id === decodedPost.id || p.slug === decodedPost.slug);
    if (existingIdx >= 0) {
      postsStore[existingIdx] = decodedPost;
    } else {
      postsStore.unshift(decodedPost);
    }
    saveToDiskStore();
  }

  const decodedSub = decodeSubscriberFromTelegram(rawText);
  if (decodedSub) {
    subscribersStore.set(decodedSub.telegramId, decodedSub);
    saveToDiskStore();
  }

  // 3. Handle messages posted directly into Telegram Group / Channel as NoSQL DB items
  const isGroupChat = message.chat?.type === "group" || message.chat?.type === "supergroup" || message.chat?.type === "channel" || chatId.startsWith("-");
  const isFromBot = Boolean(message.from?.is_bot);

  if (isGroupChat && !decodedPost && !decodedSub && !isFromBot && !rawText.startsWith("/")) {
    const isEdited = Boolean(update.edited_message || update.edited_channel_post);

    if (isEdited) {
      const existingIdx = postsStore.findIndex((p) => p.telegramMessageId === message.message_id);
      if (existingIdx >= 0) {
        const postToEdit = postsStore[existingIdx];
        if (rawText) {
          const lines = rawText.split("\n").filter((l: string) => l.trim().length > 0);
          postToEdit.title = lines[0] || postToEdit.title;
          if (lines.length > 1) {
            postToEdit.excerpt = lines.slice(1).join("\n").substring(0, 300);
            postToEdit.content = lines.slice(1).join("\n");
          }
        }
        postToEdit.updatedAt = new Date().toISOString();
        postsStore[existingIdx] = postToEdit;
        saveToDiskStore();
      }
    } else {
      if (rawText || message.photo || message.video) {
        let coverImg = "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&auto=format&fit=crop";
        let vidUrl = "";

        if (message.photo && message.photo.length > 0) {
          const largestPhoto = message.photo[message.photo.length - 1];
          coverImg = await getTelegramFileUrl(largestPhoto.file_id);
        } else if (message.video) {
          vidUrl = await getTelegramFileUrl(message.video.file_id);
          const thumbId = message.video.thumbnail?.file_id || message.video.thumb?.file_id;
          if (thumbId) coverImg = await getTelegramFileUrl(thumbId);
        }

        const lines = (rawText || "Yangi Telegram Post").split("\n").filter((l: string) => l.trim().length > 0);
        const postTitle = lines[0] || "Yangi Telegram Post";
        const bodyText = lines.length > 1 ? lines.slice(1).join("\n") : postTitle;

        const newGroupPost: BlogPostData = {
          id: `post_tg_${message.message_id}`,
          slug: `tg-post-${message.message_id}`,
          title: postTitle,
          excerpt: bodyText.substring(0, 250),
          content: bodyText,
          coverImage: coverImg,
          videoUrl: vidUrl,
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          readTime: `${Math.max(1, Math.ceil(bodyText.length / 800))} min read`,
          tags: ["Telegram", "News"],
          author: defaultAuthor,
          telegramMessageId: message.message_id,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const existingIdx = postsStore.findIndex((p) => p.telegramMessageId === message.message_id);
        if (existingIdx >= 0) {
          postsStore[existingIdx] = newGroupPost;
        } else {
          postsStore.unshift(newGroupPost);
        }
        saveToDiskStore();
      }
    }
  }

  // Handle Quick Keyboard Button Texts mapping
  let text = rawText;
  if (text === "📚 Barcha Maqolalar" || text === "📚 Maqolalar") text = "/posts";
  if (text === "📰 So'nggi Maqola") text = "/latest";
  if (text === "📊 Baza Statistikasi" || text === "📊 Statistikalar") text = "/stats";
  if (text === "🆔 Mening ID" || text === "🆔 Mening Profilim") text = "/myid";
  if (text === "👥 Obunachilar Ro'yxati") text = "/subscribers";
  if (text === "🗑️ Maqola O'chirish" || text === "🗑️ Maqolani O'chirish" || text === "✏️ Tahrirlash / O'chirish") text = "/deletepost";
  if (text === "📢 Obunachilarga Xabar Yuborish") text = "/broadcast";
  if (text === "🌐 Veb-saytga O'tish") {
    await callTelegramApi("sendMessage", {
      chat_id: chatId,
      text: `🌐 *Anvar Blog Veb-sayti:*\n${getAppUrl()}`,
      parse_mode: "Markdown",
      reply_markup: isAdmin ? getAdminReplyKeyboard() : getUserReplyKeyboard(),
    });
    return;
  }

  // Handle Active Broadcast Session for Admin
  const broadcastSession = adminBroadcastStore.get(userId);
  if (isAdmin && broadcastSession && broadcastSession.active) {
    if (
      text === "❌ Bekor Qilish" ||
      text === "❌ Yaratishni Bekor Qilish" ||
      text === "/cancel" ||
      text?.toLowerCase() === "cancel" ||
      text?.toLowerCase() === "bekor qilish"
    ) {
      adminBroadcastStore.delete(userId);
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: "🛑 *Xabar yuborish bekor qilindi.*",
        parse_mode: "Markdown",
        reply_markup: getAdminReplyKeyboard(),
      });
      return;
    }

    if (!text) {
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: "⚠️ *Matnli xabar yuborishingiz kerak!*",
        reply_markup: {
          keyboard: [[{ text: "❌ Bekor Qilish" }]],
          resize_keyboard: true,
          persistent: true
        }
      });
      return;
    }

    // Process sending to all subscribers
    const subs = getSubscribersList();
    let successCount = 0;
    
    // Send status indicator
    const statusMsg = await callTelegramApi("sendMessage", {
      chat_id: chatId,
      text: `⏳ *Xabar ${subs.length} obunachiga yuborilmoqda...*`,
      parse_mode: "Markdown"
    });

    for (const sub of subs) {
      try {
        const res = await callTelegramApi("sendMessage", {
          chat_id: sub.telegramId,
          text: `📢 *ANVAR BLOG E'LONI:*\n\n${text}`,
          parse_mode: "Markdown",
        });
        if (res && res.ok) {
          successCount++;
        }
      } catch (e) {
        // Ignore single user failure
      }
    }

    adminBroadcastStore.delete(userId);

    // Delete temporary status message
    if (statusMsg && statusMsg.result && statusMsg.result.message_id) {
      try {
        await callTelegramApi("deleteMessage", {
          chat_id: chatId,
          message_id: statusMsg.result.message_id
        });
      } catch (e) {
        // Ignore delete failure
      }
    }

    await callTelegramApi("sendMessage", {
      chat_id: chatId,
      text: `✅ *Xabar muvaffaqiyatli tarqatildi!*\n\n• Jami obunachilar: *${subs.length} ta*\n• Muvaffaqiyatli yuborildi: *${successCount} ta*`,
      parse_mode: "Markdown",
      reply_markup: getAdminReplyKeyboard(),
    });
    return;
  }

  // Handle Active Edit Session for Admin
  const editSession = adminEditStore.get(userId);
  if (isAdmin && editSession) {
    const { postId, fieldToEdit } = editSession;

    // Check if admin clicked "Cancel" button or typed /cancel
    if (
      text === "❌ Bekor Qilish" ||
      text === "❌ Tahrirlashni Bekor Qilish" ||
      text === "/cancel" ||
      text?.toLowerCase() === "cancel" ||
      text?.toLowerCase() === "bekor"
    ) {
      adminEditStore.delete(userId);
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: "🛑 *Tahrirlash jarayoni to'xtatildi.*",
        parse_mode: "Markdown",
        reply_markup: getAdminReplyKeyboard(),
      });
      return;
    }

    if (!fieldToEdit) {
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: "ℹ️ <b>Siz maqolani tahrirlash rejimidasiz.</b>\n\nIltimos, yuqoridagi xabardan tahrirlamoqchi bo'lgan tugmani tanlang, yoki tahrirlashdan chiqish uchun quyidagi tugmani bosing:",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Tahrirlashni Bekor Qilish", callback_data: `edit_field_CANCEL_${postId}` }]
          ]
        }
      });
      return;
    }

    const post = getPostBySlugFromStore(postId);
    if (!post) {
      adminEditStore.delete(userId);
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: "⚠️ <b>Xatolik:</b> Tahrirlanayotgan maqola topilmadi yoki o'chirilgan.",
        parse_mode: "HTML",
        reply_markup: getAdminReplyKeyboard(),
      });
      return;
    }

    let updatedData: Partial<BlogPostData> = {};
    let isValid = true;
    let errorMsg = "";

    if (fieldToEdit === "TITLE") {
      if (!text) {
        isValid = false;
        errorMsg = "Sarlavha faqat matn ko'rinishida bo'lishi shart!";
      } else {
        const check = validateTitle(text);
        if (!check.isValid) {
          isValid = false;
          errorMsg = check.error || "Noma'lum xato.";
        } else {
          updatedData.title = text.trim();
        }
      }
    } else if (fieldToEdit === "EXCERPT") {
      if (!text) {
        isValid = false;
        errorMsg = "Qisqacha mazmun faqat matn ko'rinishida bo'lishi shart!";
      } else {
        const len = text.trim().length;
        if (len < 10 || len > 300) {
          isValid = false;
          errorMsg = "Qisqacha mazmun uzunligi 10 tadan 300 tagacha belgidan iborat bo'lishi shart!";
        } else {
          updatedData.excerpt = text.trim();
        }
      }
    } else if (fieldToEdit === "CONTENT") {
      if (!text) {
        isValid = false;
        errorMsg = "Maqola matni faqat matn ko'rinishida bo'lishi shart!";
      } else {
        const len = text.trim().length;
        if (len < 50) {
          isValid = false;
          errorMsg = "Maqola matni uzunligi kamida 50 ta belgi bo'lishi shart!";
        } else {
          updatedData.content = text.trim();
          updatedData.readTime = `${Math.max(1, Math.ceil(len / 800))} min o'qish`;
        }
      }
    } else if (fieldToEdit === "MEDIA") {
      let coverImg = "";
      let vidUrl = "";

      if (message.photo && message.photo.length > 0) {
        const largestPhoto = message.photo[message.photo.length - 1];
        coverImg = await getTelegramFileUrl(largestPhoto.file_id);
      } else if (message.video) {
        vidUrl = await getTelegramFileUrl(message.video.file_id);
        const thumbFileId = message.video.thumbnail?.file_id || message.video.thumb?.file_id;
        if (thumbFileId) {
          coverImg = await getTelegramFileUrl(thumbFileId);
        } else {
          coverImg = "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&auto=format&fit=crop";
        }
      } else if (text) {
        const trimmed = text.trim().toLowerCase();
        if (trimmed === "default" || trimmed === "standart" || trimmed === "skip") {
          coverImg = "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&auto=format&fit=crop";
        } else if (text.startsWith("http://") || text.startsWith("https://")) {
          coverImg = text.trim();
        } else {
          isValid = false;
          errorMsg = "Rasm yuborishingiz, rasm havolasini yuborishingiz yoki 'default' deb yozishingiz shart!";
        }
      } else {
        isValid = false;
        errorMsg = "Rasm, video yoki rasm havolasini yuboring.";
      }

      if (isValid) {
        updatedData.coverImage = coverImg;
        if (vidUrl) {
          updatedData.videoUrl = vidUrl;
        } else {
          updatedData.videoUrl = "";
        }
      }
    } else if (fieldToEdit === "YOUTUBE") {
      if (!text) {
        isValid = false;
        errorMsg = "Havola matn ko'rinishida bo'lishi shart!";
      } else {
        const trimmed = text.trim().toLowerCase();
        if (trimmed === "skip" || trimmed === "none" || trimmed === "yo'q" || trimmed === "yoq") {
          updatedData.youtubeUrl = "";
        } else {
          const parsedYoutube = parseYoutubeEmbedUrl(text);
          if (parsedYoutube) {
            updatedData.youtubeUrl = parsedYoutube;
          } else {
            isValid = false;
            errorMsg = "YouTube havolasi noto'g'ri formatda. Namuna: `https://www.youtube.com/watch?v=...`";
          }
        }
      }
    } else if (fieldToEdit === "QUOTE") {
      if (!text) {
        isValid = false;
        errorMsg = "Iqtibos matn bo'rinishida bo'lishi shart!";
      } else {
        const trimmed = text.trim().toLowerCase();
        if (trimmed === "skip" || trimmed === "none" || trimmed === "yo'q" || trimmed === "yoq") {
          updatedData.quote = undefined;
        } else {
          updatedData.quote = { text: text.trim(), author: "Anvar" };
        }
      }
    }

    if (!isValid) {
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: `⚠️ <b>Xatolik kiritildi:</b> ${errorMsg}\n\nIltimos, yangi qiymatni to'g'ri formatda qaytadan yuboring yoki quyidagi '🔙 Orqaga' tugmasini bosing:`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Orqaga (Bekor Qilish)", callback_data: `edit_field_BACK_${postId}` }]
          ]
        }
      });
      return;
    }

    // Input is valid! Update the post!
    await updatePostInTelegram(postId, updatedData);

    // Reset specific fieldToEdit, keep postId session active
    adminEditStore.set(userId, { postId });

    // Notify success and show the fields menu again
    const { text: updatedFieldsText, reply_markup: updatedFieldsMarkup } = getPostEditFieldsKeyboard(postId);
    await callTelegramApi("sendMessage", {
      chat_id: chatId,
      text: `✅ <b>Muvaffaqiyatli tahrirlandi!</b>\n\n${updatedFieldsText}`,
      parse_mode: "HTML",
      reply_markup: updatedFieldsMarkup,
    });
    return;
  }

  // Start Step-by-Step Creation Wizard
  if ((text === "➕ Yangi Maqola Yaratish (Step-by-Step)" || text === "/newpost") && isAdmin) {
    adminWizardStore.set(userId, {
      step: "TITLE",
      postData: { author: defaultAuthor, tags: ["General"] },
    });

    await callTelegramApi("sendMessage", {
      chat_id: chatId,
      text: `📝 *Step-by-Step Maqola Yaratish (1/6)*\n\n` +
        `Iltimos, maqolaning **Sarlavhasini (Title)** yozib yuboring:\n` +
        `• Uzunlik: **5 tadan 120 tagacha belgi**\n` +
        `• Tushunarli va mazmunli so'zlardan iborat bo'lsin\n\n` +
        `🛑 *Jarayonni xohlagan vaqtda to'xtatish uchun pastdagi '❌ Yaratishni Bekor Qilish' tugmasini bosing.*`,
      parse_mode: "Markdown",
      reply_markup: getWizardReplyKeyboard(),
    });
    return;
  }

  // Process Interactive Wizard Steps for Admin
  const session = adminWizardStore.get(userId);
  if (isAdmin && session) {
    // Check if admin clicked "Cancel" button or typed /cancel
    if (
      text === "❌ Yaratishni Bekor Qilish" ||
      text === "/cancel" ||
      text?.toLowerCase() === "bekor qilish" ||
      text?.toLowerCase() === "cancel"
    ) {
      adminWizardStore.delete(userId);
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: `🛑 *Maqola yaratish jarayoni bekor qilindi.*`,
        parse_mode: "Markdown",
        reply_markup: getAdminReplyKeyboard(),
      });
      return;
    }

    // Step 1: TITLE -> EXCERPT
    if (session.step === "TITLE") {
      if (!text) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ *MEDIA EMAS, SARLAVHA MATNINI YUBORING!*\n\nSiz rasm yoki fayl yubordingiz. 1-bosqichda sizdan maqola **Sarlavhasi (Title)** matn ko'rinishida kutilmoqda (5 tadan 120 tagacha belgi).`,
          parse_mode: "Markdown",
          reply_markup: getWizardReplyKeyboard(),
        });
        return;
      }

      const titleValidation = validateTitle(text);
      if (!titleValidation.isValid) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ *SARLAVHA (TITLE) NOTO'G'RI FORMATDA!*\n\n` +
            `❌ *Xatolik:* ${titleValidation.error}\n\n` +
            `📌 *Format Talablari:*\n` +
            `• Uzunligi: **5 tadan 120 tagacha belgi**\n` +
            `• Ma'noli so'zlar va kamida 4 ta harfdan iborat bo'lishi shart\n` +
            `• Namuna: *'Bugun O'zbekistonda Texnologiya va Sun'iy Intelekt'*\n\n` +
            `✍️ *Iltimos, qaytadan mos va to'g'ri Sarlavha yozib yuboring:*`,
          parse_mode: "Markdown",
          reply_markup: getWizardReplyKeyboard(),
        });
        return;
      }

      session.postData.title = text.trim();
      session.step = "EXCERPT";
      adminWizardStore.set(userId, session);

      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: `✍️ *Step-by-Step Maqola Yaratish (2/6)*\n\n` +
          `✅ Sarlavha saqlandi: *"${text.trim()}"*\n\n` +
          `Endi maqola haqida **Qisqacha Mazmun (Excerpt / Summary)** yozib yuboring:\n` +
          `• Uzunlik: **10 tadan 300 tagacha belgi** bo'lishi kerak`,
        parse_mode: "Markdown",
        reply_markup: getWizardReplyKeyboard(),
      });
      return;
    }

    // Step 2: EXCERPT -> MEDIA
    if (session.step === "EXCERPT") {
      if (!text) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ *MEDIA EMAS, QISQACHA MAZMUN MATNINI YUBORING!*\n\nSiz rasm yoki fayl yubordingiz. 2-bosqichda **Qisqacha Mazmun (Excerpt)** matn ko'rinishida kutilmoqda (10 tadan 300 tagacha belgi).`,
          parse_mode: "Markdown",
          reply_markup: getWizardReplyKeyboard(),
        });
        return;
      }

      const excerptValidation = validateExcerpt(text);
      if (!excerptValidation.isValid) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ *QISQACHA MAZMUN NOTO'G'RI FORMATDA!*\n\n` +
            `❌ *Xatolik:* ${excerptValidation.error}\n\n` +
            `✍️ *Iltimos, kamida 10 ta belgidan iborat mazmunli tushuntirish yozing:*`,
          parse_mode: "Markdown",
          reply_markup: getWizardReplyKeyboard(),
        });
        return;
      }

      session.postData.excerpt = text.trim();
      session.step = "MEDIA";
      adminWizardStore.set(userId, session);

      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: `📸 *Step-by-Step Maqola Yaratish (3/6)*\n\n` +
          `✅ Qisqacha mazmun saqlandi!\n\n` +
          `Endi maqola uchun **Rasm yoki Video** yuboring:\n` +
          `• Rasm yoki Video fayli sifatida ushbu chatga yuklang\n` +
          `• Yoki Rasm / Video havolasini (URL) matn sifatida yuboring:\n` +
          `• Yoki standart rasmdan foydalanish uchun **'default'** deb yozing`,
        parse_mode: "Markdown",
        reply_markup: getWizardReplyKeyboard(),
      });
      return;
    }

    // Step 3: MEDIA -> YOUTUBE
    if (session.step === "MEDIA") {
      let coverImg = "";
      let vidUrl = "";

      // Check if user uploaded a photo
      if (message.photo && message.photo.length > 0) {
        const largestPhoto = message.photo[message.photo.length - 1];
        coverImg = await getTelegramFileUrl(largestPhoto.file_id);
      } else if (message.video) {
        vidUrl = await getTelegramFileUrl(message.video.file_id);
        // Try getting video thumbnail if present
        const thumbFileId = message.video.thumbnail?.file_id || message.video.thumb?.file_id;
        if (thumbFileId) {
          coverImg = await getTelegramFileUrl(thumbFileId);
        } else {
          coverImg = "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&auto=format&fit=crop";
        }
      } else if (text) {
        const trimmed = text.trim().toLowerCase();
        if (trimmed === "default" || trimmed === "skip" || trimmed === "yo'q" || trimmed === "standart" || trimmed === "yoq") {
          coverImg = "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&auto=format&fit=crop";
        } else if (text.startsWith("http://") || text.startsWith("https://")) {
          const parsedYt = parseYoutubeEmbedUrl(text);
          if (parsedYt) {
            session.postData.youtubeUrl = parsedYt;
            coverImg = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1200&auto=format&fit=crop";
          } else {
            coverImg = text.trim();
          }
        } else {
          // Reject invalid text
          await callTelegramApi("sendMessage", {
            chat_id: chatId,
            text: `⚠️ *RASM YOKI VIDEO FORMATI NOTO'G'RI!*\n\n` +
              `Siz kiritgan matn (*"${text}"*) Rasm yoki Video havolasi (URL) emas.\n\n` +
              `📌 *Iltimos, quyidagilardan birini bajarib yuboring:*\n` +
              `1. Telegram chatga **Rasm yoki Video faylini** yuklang\n` +
              `2. Yoki **'https://...'** bilan boshlanuvchi to'g'ri rasm havolasini yuboring\n` +
              `3. Yoki standart rasmdan foydalanish uchun **'default'** deb yozib yuboring!`,
            parse_mode: "Markdown",
            reply_markup: getWizardReplyKeyboard(),
          });
          return;
        }
      } else {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ *RASM YOKI VIDEO YUKLANMADI!*\n\n` +
            `Iltimos, Rasm/Video faylini yuboring yoki rasm havolasini (\`https://...\`) yozing (yoki **'default'** deb yozing):`,
          parse_mode: "Markdown",
          reply_markup: getWizardReplyKeyboard(),
        });
        return;
      }

      session.postData.coverImage = coverImg || "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&auto=format&fit=crop";
      if (vidUrl) session.postData.videoUrl = vidUrl;

      session.step = "YOUTUBE";
      adminWizardStore.set(userId, session);

      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: `🎬 *Step-by-Step Maqola Yaratish (4/6)*\n\n` +
          `Media muvaffaqiyatli qabul qilindi! ✅\n\n` +
          `Ushbu maqolaga **YouTube Video Linki** (Standard yoki Shorts) biriktirasizmi?\n` +
          `• YouTube linkini yuboring (\`https://www.youtube.com/watch?v=...\` yoki \`https://youtube.com/shorts/...\`)\n` +
          `• Yoki ushbu bosqichni o'tkazib yuborish uchun **'Skip'** deb yozing:`,
        parse_mode: "Markdown",
        reply_markup: getWizardReplyKeyboard(),
      });
      return;
    }

    // Step 4: YOUTUBE -> CONTENT
    if (session.step === "YOUTUBE") {
      if (!text) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ *RASM EMAS, YOUTUBE LINKI YOKI 'SKIP' MATNINI YUBORING!*\n\nSiz rasm/fayl yubordingiz. 4-bosqichda YouTube havolasi kutilmoqda. O'tkazib yuborish uchun **'skip'** deb yozing!`,
          parse_mode: "Markdown",
          reply_markup: getWizardReplyKeyboard(),
        });
        return;
      }

      const trimmed = text.trim().toLowerCase();
      if (trimmed === "skip" || trimmed === "yo'q" || trimmed === "yoq" || trimmed === "default") {
        // Skipped
      } else {
        const parsedYoutube = parseYoutubeEmbedUrl(text);
        if (parsedYoutube) {
          session.postData.youtubeUrl = parsedYoutube;
        } else {
          await callTelegramApi("sendMessage", {
            chat_id: chatId,
            text: `⚠️ *YOUTUBE LINKI NOTO'G'RI FORMATDA!*\n\n` +
              `Siz kiritgan matn (*"${text}"*) to'g'ri YouTube havolasi emas.\n\n` +
              `📌 *Qabul qilinadigan YouTube formatlari:*\n` +
              `• YouTube Shorts: \`https://www.youtube.com/shorts/...\`\n` +
              `• Standard video: \`https://www.youtube.com/watch?v=...\`\n` +
              `• Qisqa link: \`https://youtu.be/...\`\n\n` +
              `• Yoki ushbu bosqichni o'tkazib yuborish uchun **'skip'** deb yozing!`,
            parse_mode: "Markdown",
            reply_markup: getWizardReplyKeyboard(),
          });
          return;
        }
      }

      session.step = "CONTENT";
      adminWizardStore.set(userId, session);

      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: `📖 *Step-by-Step Maqola Yaratish (5/6)*\n\n` +
          `Endi maqolaning **To'liq Matnini (Content)** yozib yuboring (kamida 20 ta belgi):`,
        parse_mode: "Markdown",
        reply_markup: getWizardReplyKeyboard(),
      });
      return;
    }

    // Step 5: CONTENT -> QUOTE
    if (session.step === "CONTENT") {
      if (!text) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ *RASM EMAS, MAQOLANING TO'LIQ MATNINI YUBORING!*\n\nSiz rasm yoki fayl yubordingiz. 5-bosqichda maqolaning **To'liq Matni (Content)** matn ko'rinishida kutilmoqda (kamida 20 ta belgi).`,
          parse_mode: "Markdown",
          reply_markup: getWizardReplyKeyboard(),
        });
        return;
      }

      const contentValidation = validateContent(text);
      if (!contentValidation.isValid) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ *MAQOLA MATNI NOTO'G'RI FORMATDA!*\n\n` +
            `❌ *Xatolik:* ${contentValidation.error}\n\n` +
            `✍️ *Iltimos, kamida 20 ta belgidan iborat to'liq matn yozing:*`,
          parse_mode: "Markdown",
          reply_markup: getWizardReplyKeyboard(),
        });
        return;
      }

      session.postData.content = text.trim();
      session.step = "QUOTE";
      adminWizardStore.set(userId, session);

      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: `💬 *Step-by-Step Maqola Yaratish (6/6)*\n\n` +
          `✅ Maqola matni saqlandi!\n\n` +
          `Maqola uchun **Iqtibos (Quote)** kiritasizmi?\n` +
          `• Format: \`Iqtibos matni | Muallif\`\n` +
          `• Yoki bo'lmasa **'Skip'** deb yozib yuboring:`,
        parse_mode: "Markdown",
        reply_markup: getWizardReplyKeyboard(),
      });
      return;
    }

    // Step 6: QUOTE -> FINALIZE POST!
    if (session.step === "QUOTE") {
      if (!text) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ *RASM EMAS, IQTIBOS MATNINI YUBORING!*\n\nSiz rasm yoki fayl yubordingiz. 6-bosqichda **Iqtibos (Quote)** matni kutilmoqda.\n\n📌 **Format:** \`Iqtibos matni | Muallif\`\n📌 Yoki ushbu bosqichni o'tkazib yuborish uchun **'skip'** deb yozib yuboring!`,
          parse_mode: "Markdown",
          reply_markup: getWizardReplyKeyboard(),
        });
        return;
      }

      const trimmed = text.trim().toLowerCase();
      if (trimmed !== "skip" && trimmed !== "yo'q" && trimmed !== "yoq" && trimmed !== "default" && trimmed !== "standart") {
        if (!isRealHumanText(text)) {
          await callTelegramApi("sendMessage", {
            chat_id: chatId,
            text: `⚠️ *IQTIBOS MATNI NOTO'G'RI!*\n\n` +
              `Siz kiritgan matn mazmunsiz yoki tasodifiy harflardan iborat.\n\n` +
              `📌 *Iltimos:*\n` +
              `• Format: \`Iqtibos matni | Muallif\`\n` +
              `• Yoki ushbu bosqichni o'tkazib yuborish uchun **'skip'** deb yozing!`,
            parse_mode: "Markdown",
            reply_markup: getWizardReplyKeyboard(),
          });
          return;
        }

        if (text.includes("|")) {
          const parts = text.split("|").map((p) => p.trim());
          session.postData.quote = {
            text: parts[0] || text,
            author: parts[1] || defaultAuthor.name,
          };
        } else if (text.trim().length >= 4) {
          session.postData.quote = {
            text: text.trim(),
            author: defaultAuthor.name,
          };
        }
      }

      // Complete Post Creation
      const completedPost = await createPostInTelegram(session.postData);
      adminWizardStore.delete(userId);

      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: `🎉 *MAQOLA MUVAFFAQIYATLI YARATILDI VA GURUH BAZASIGA SAQLANDI!* 🚀\n\n` +
          `📌 Sarlavha: *${completedPost.title}*\n` +
          `🆔 ID: \`${completedPost.id}\`\n\n` +
          `📢 Veb-saytga joylandi va barcha obunachilarga xabar yuborildi!`,
        parse_mode: "Markdown",
        reply_markup: getAdminReplyKeyboard(),
      });
      return;
    }
  }

  // Standard Command Router
  if (text.startsWith("/")) {
    const [command, ...args] = text.split(" ");

    // Security Guard: Check if a non-admin is trying to access admin commands
    const adminCommands = ["/admin", "/newpost", "/broadcast", "/subscribers", "/delete", "/deletepost", "/stats"];
    if (adminCommands.includes(command) && !isAdmin) {
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: "⚠️ *Kechirasiz, bu buyruq faqat bot Asosiy Admini (Anvar) uchun ruxsat etilgan!* \n\nSiz oddiy obunachi maqomidasiz va ushbu bo'limga kirish yoki tahrirlash huquqiga ega emassiz.",
        parse_mode: "Markdown",
        reply_markup: getUserReplyKeyboard(),
      });
      return;
    }

    // /stats
    if (command === "/stats") {
      const stats = getSystemStats();
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: `📊 *SISTEMA VA GURUH BAZASI STATISTIKASI:*\n\n` +
          `• Total Maqolalar: *${stats.totalPosts} ta*\n` +
          `• Total Obunachilar: *${stats.totalSubscribers} ta*\n` +
          `• Telegram Guruh Baza ID: \`${stats.telegramGroupId}\`\n` +
          `• Baza Holati: ✅ *Aktiv va Telegram Baza Bilan Bog'langan*\n` +
          `• Server Linki: ${getAppUrl()}`,
        parse_mode: "Markdown",
        reply_markup: isAdmin ? getAdminReplyKeyboard() : getUserReplyKeyboard(),
      });
      return;
    }

    // /search
    if (command === "/search") {
      const query = args.join(" ").toLowerCase().trim();
      if (!query) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: "Ishlatish: `/search <kalit_soz>`\nMasalan: `/search fotogalereya`",
          parse_mode: "Markdown",
        });
        return;
      }

      const results = postsStore.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.excerpt.toLowerCase().includes(query) ||
          p.content.toLowerCase().includes(query) ||
          p.tags.some((t) => t.toLowerCase().includes(query))
      );

      if (results.length === 0) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `🔍 *'${query}'* bo'yicha hech qanday maqola topilmadi.`,
          parse_mode: "Markdown",
        });
        return;
      }

      let resText = `🔍 *'${query}' bo'yicha topilgan maqolalar (${results.length} ta):*\n\n`;
      results.forEach((r, idx) => {
        resText += `${idx + 1}. *${r.title}*\nID: \`${r.id}\` | Sana: ${r.date}\n\n`;
      });

      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: resText,
        parse_mode: "Markdown",
        reply_markup: isAdmin ? getAdminReplyKeyboard() : getUserReplyKeyboard(),
      });
      return;
    }

    // /myid
    if (command === "/myid") {
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: `🆔 *Sizning Telegram Tafsilotlaringiz:*\n\n` +
          `• Telegram ID: \`${userId}\`\n` +
          `• Chat ID: \`${chatId}\`\n` +
          `• Username: @${username || "yo'q"}\n` +
          `• Ism: ${firstName} ${lastName}\n` +
          `• Maqom: ${isAdmin ? "👑 *ASOSIY ADMIN (ANVAR) - TO'LIQ RUXSAT*" : "👤 Oddiy Obunachi"}`,
        parse_mode: "Markdown",
        reply_markup: isAdmin ? getAdminReplyKeyboard() : getUserReplyKeyboard(),
      });
      return;
    }

    // /start, /help, /admin
    if (command === "/start" || command === "/help" || command === "/admin") {
      await addSubscriber({
        telegramId: userId,
        username,
        firstName,
        lastName,
      });

      if (isAdmin) {
        const adminMsg = `👑 *XUSH KELIBSIZ, ASOSIY ADMIN (ANVAR)!*\n\n` +
          `Sizda Telegram Bot va Baza ustidan to'liq boshqaruv huquqlari bor.\n\n` +
          `🔘 *Ekrandagi Step-by-Step tugmalar orqali maqola, rasm, video va e'lonlar yarating!*`;

        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: adminMsg,
          parse_mode: "Markdown",
          reply_markup: getAdminReplyKeyboard(),
        });
        return;
      } else {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `👋 Xush kelibsiz, ${firstName}!\n\n` +
            `Siz Anvarning shaxsiy blog va yangiliklar botiga muvaffaqiyatli ulandingiz.\n` +
            `Yangi maqolalar chop etilganda sizga avtomatik bildirishnoma yuboriladi!`,
          reply_markup: getUserReplyKeyboard(),
        });
        return;
      }
    }

    // /latest
    if (command === "/latest") {
      const latest = postsStore[0];
      if (latest) {
        const msg = `📰 *${latest.title}*\n\n${latest.excerpt}\n\n📅 ${latest.date} · ⏱️ ${latest.readTime}`;
        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "📖 Veb-saytda o'qish", url: `${getAppUrl()}/post/${latest.slug}` }
            ],
            isAdmin ? [{ text: "🗑 Maqolani O'chirish", callback_data: `delete_post_${latest.id}` }] : []
          ].filter((row) => row.length > 0)
        };

        if (latest.coverImage && (latest.coverImage.startsWith("http") || latest.coverImage.startsWith("https"))) {
          await callTelegramApi("sendPhoto", {
            chat_id: chatId,
            photo: latest.coverImage,
            caption: msg,
            parse_mode: "Markdown",
            reply_markup: inlineKeyboard,
          });
        } else {
          await callTelegramApi("sendMessage", {
            chat_id: chatId,
            text: msg,
            parse_mode: "Markdown",
            reply_markup: inlineKeyboard,
          });
        }
      } else {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: "Hozircha guruh bazasida chop etilgan maqolalar yo'q. Step-by-step tugmasi orqali maqola yarating!",
          reply_markup: isAdmin ? getAdminReplyKeyboard() : getUserReplyKeyboard(),
        });
      }
      return;
    }

    // /posts or /all or /deletepost
    if (command === "/posts" || command === "/all" || command === "/deletepost") {
      const { text: pageText, reply_markup: pageMarkup } = getPaginatedPostsKeyboard(0, isAdmin);
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: pageText,
        parse_mode: "Markdown",
        reply_markup: pageMarkup,
      });
      return;
    }

    // Admin Commands
    if (isAdmin) {
      if (command === "/broadcast") {
        const broadcastMsg = args.join(" ");
        if (!broadcastMsg) {
          adminBroadcastStore.set(userId, { active: true });
          await callTelegramApi("sendMessage", {
            chat_id: chatId,
            text: `📢 *OBUNACHILARGA XABAR YUBORISH (E'LON)*\n\n` +
              `Barcha obunachilarga tarqatmoqchi bo'lgan xabaringiz matnini yuboring (Markdown qo'llab-quvvatlanadi).\n\n` +
              `🛑 *Bekor qilish uchun pastdagi '❌ Bekor Qilish' tugmasini bosing.*`,
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [[{ text: "❌ Bekor Qilish" }]],
              resize_keyboard: true,
              persistent: true
            }
          });
          return;
        }

        const subs = getSubscribersList();
        let successCount = 0;
        for (const sub of subs) {
          try {
            const res = await callTelegramApi("sendMessage", {
              chat_id: sub.telegramId,
              text: `📢 *ANVAR BLOG E'LONI:*\n\n${broadcastMsg}`,
              parse_mode: "Markdown",
            });
            if (res && res.ok) successCount++;
          } catch (e) {
            // Ignore single user failure
          }
        }

        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `✅ Xabar ${successCount}/${subs.length} obunachiga muvaffaqiyatli yuborildi!`,
          reply_markup: getAdminReplyKeyboard(),
        });
        return;
      }

      if (command === "/subscribers") {
        const subs = getSubscribersList();
        let subText = `👥 *Obunachilar Ro'yxati (${subs.length} ta):*\n\n`;
        subs.forEach((s, i) => {
          subText += `${i + 1}. ${s.firstName || "Foydalanuvchi"} ${s.lastName || ""} (@${s.username || "no_user"}) [ID: \`${s.telegramId}\`]\n`;
        });

        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: subText || "Hozircha hech kim obuna bo'lmagan.",
          parse_mode: "Markdown",
          reply_markup: getAdminReplyKeyboard(),
        });
        return;
      }

      if (command === "/delete") {
        const postId = args[0];
        if (!postId) {
          await callTelegramApi("sendMessage", {
            chat_id: chatId,
            text: "Ishlatish: `/delete <post_id>`",
            parse_mode: "Markdown",
          });
          return;
        }

        const success = await deletePostFromTelegram(postId);
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: success ? `✅ Post \`${postId}\` bazadan o'chirildi!` : `❌ Post \`${postId}\` topilmadi.`,
          parse_mode: "Markdown",
          reply_markup: getAdminReplyKeyboard(),
        });
        return;
      }
    }
  }
}
