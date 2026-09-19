import { z } from "zod";

// Zod Schema for Subscriber Payload Validation
export const SubscriberSchema = z.object({
  telegramId: z.string().min(1, "Telegram ID is required"),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// Zod Schema for Blog Post Validation (Expert schemas for strict data integrity)
export const BlogPostSchema = z.object({
  id: z.string().min(1, "Post ID is required"),
  slug: z.string().min(1, "Slug is required"),
  title: z.string().min(1, "Title is required"),
  excerpt: z.string().min(1, "Excerpt is required"),
  content: z.string().min(1, "Content is required"),
  coverImage: z.string().url("Cover image must be a valid URL or path"),
  youtubeUrl: z.string().url("YouTube URL must be valid").optional().or(z.literal("")),
  videoUrl: z.string().optional(),
  mediaGallery: z.array(z.string()).optional(),
  quote: z.object({
    text: z.string(),
    author: z.string().optional(),
  }).optional(),
  date: z.string(),
  readTime: z.string(),
  tags: z.array(z.string()),
  author: z.object({
    name: z.string(),
    avatar: z.string(),
    bio: z.string(),
  }),
  telegramMessageId: z.number().optional(),
  isDeleted: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

// Zod Schema for Telegram Webhook Updates (To filter out malicious or malformed requests)
export const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      is_bot: z.boolean().optional(),
      first_name: z.string(),
      last_name: z.string().optional(),
      username: z.string().optional(),
      language_code: z.string().optional(),
    }).optional(),
    chat: z.object({
      id: z.number(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      username: z.string().optional(),
      type: z.string(),
      title: z.string().optional(),
    }),
    date: z.number(),
    text: z.string().optional(),
    photo: z.array(
      z.object({
        file_id: z.string(),
        file_unique_id: z.string(),
        file_size: z.number().optional(),
        width: z.number(),
        height: z.number(),
      })
    ).optional(),
    video: z.object({
      file_id: z.string(),
      file_unique_id: z.string(),
      duration: z.number(),
      width: z.number(),
      height: z.number(),
      mime_type: z.string().optional(),
      file_size: z.number().optional(),
    }).optional(),
    caption: z.string().optional(),
  }).optional(),
  callback_query: z.object({
    id: z.string(),
    from: z.object({
      id: z.number(),
      first_name: z.string(),
      username: z.string().optional(),
    }),
    message: z.any().optional(),
    data: z.string(),
  }).optional(),
});
