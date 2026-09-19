import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
// Dynamic sharp loader for cross-environment compatibility (Node.js & Cloudflare Workers)
async function getSharpModule() {
  try {
    const m = await import("sharp");
    return m.default || m;
  } catch (e) {
    return null;
  }
}

// Environment variables for Cloudflare R2 (retrieved strictly from process.env secrets)
function getR2Config() {
  const accountId = (process.env.CLOUDFLARE_R2_ACCOUNT_ID || "").trim();
  const bucketName = (process.env.CLOUDFLARE_R2_BUCKET_NAME || "").trim();
  const accessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "").trim();
  return { accountId, bucketName, accessKeyId, secretAccessKey };
}

let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client {
  const { accountId, bucketName, accessKeyId, secretAccessKey } = getR2Config();
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Cloudflare R2 credentials (CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY) are not set in environment.");
  }
  if (!s3ClientInstance) {
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
}

export function isR2Configured(): boolean {
  const { accountId, bucketName, accessKeyId, secretAccessKey } = getR2Config();
  return Boolean(accountId && bucketName && accessKeyId && secretAccessKey);
}

/**
 * Uploads a buffer to Cloudflare R2 bucket.
 * Returns the key (filename) of the uploaded object.
 */
export async function uploadBufferToR2(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const { bucketName } = getR2Config();
  const s3 = getS3Client();
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3.send(command);
    console.log(`[R2] Successfully uploaded file: ${key} to bucket: ${bucketName}`);
    return key;
  } catch (error) {
    console.error(`[R2] Error uploading to R2 for key ${key}:`, error);
    throw error;
  }
}

/**
 * Fetches an object from Cloudflare R2.
 */
export async function getObjectFromR2(key: string) {
  const { bucketName } = getR2Config();
  const s3 = getS3Client();
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3.send(command);
    return {
      body: response.Body,
      contentType: response.ContentType,
    };
  } catch (error) {
    console.error(`[R2] Error fetching from R2 for key ${key}:`, error);
    throw error;
  }
}

/**
 * Generates an AWS S3 Presigned URL for secure, direct download from Cloudflare CDN.
 * Link expires in 24 hours. Completely offloads bandwidth from node.js server.
 */
export async function getPresignedDownloadUrl(key: string): Promise<string> {
  const { bucketName } = getR2Config();
  const s3 = getS3Client();
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    // Generate a secure signed URL that redirects directly to Cloudflare CDN (expires in 24 hours)
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 86400 });
    return signedUrl;
  } catch (error) {
    console.error(`[R2 PresignedUrl] Error generating signed URL for key ${key}:`, error);
    throw error;
  }
}

/**
 * Given a Telegram file URL, downloads it to memory, optimizes it (if image), and uploads it to Cloudflare R2.
 * Returns the local API path `/api/media/<key>` which will serve the file from R2.
 */
export async function transferTelegramFileToR2(telegramUrl: string): Promise<string | null> {
  if (!telegramUrl) return null;

  // Verify if it's a telegram file URL
  if (!telegramUrl.includes("api.telegram.org") && !telegramUrl.includes("telegram-file")) {
    return telegramUrl; // Already a different URL or already processed
  }

  try {
    console.log(`[R2] Initiating transfer of Telegram file: ${telegramUrl}`);
    const response = await fetch(telegramUrl);
    if (!response.ok) {
      console.error(`[R2] Failed to download file from Telegram: ${response.statusText}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a unique key for R2
    const urlParts = telegramUrl.split("/");
    const origFileName = urlParts[urlParts.length - 1] || "file";
    
    // Create a clean key to prevent directory traversal or invalid chars
    const cleanOrigName = origFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    let uniqueKey = `media_${Date.now()}_${cleanOrigName}`;

    let bufferToUpload = buffer;
    let contentTypeToUpload = contentType;

    // Image Optimization Pipeline with Sharp (WebP, Max Width: 1920px)
    if (contentType.startsWith("image/") && !contentType.includes("gif") && !contentType.includes("svg")) {
      try {
        const sharp = await getSharpModule();
        if (sharp) {
          console.log(`[R2 Sharp] Optimizing image: converting to compressed WebP...`);
          const optimizedBuffer = await sharp(buffer)
            .resize({ width: 1920, withoutEnlargement: true }) // Desktop/Mobile density scale
            .webp({ quality: 80 }) // 80% WebP high-performance compression
            .toBuffer();

          bufferToUpload = optimizedBuffer;
          contentTypeToUpload = "image/webp";

          // Rename key with webp extension
          const lastDot = uniqueKey.lastIndexOf(".");
          const keyWithoutExt = lastDot > 0 ? uniqueKey.substring(0, lastDot) : uniqueKey;
          uniqueKey = `${keyWithoutExt}.webp`;
          console.log(`[R2 Sharp] Image successfully optimized: ${uniqueKey}`);
        }
      } catch (sharpError) {
        console.error(`[R2 Sharp] Sharp optimization failed, uploading original raw file:`, sharpError);
      }
    }

    await uploadBufferToR2(bufferToUpload, uniqueKey, contentTypeToUpload);

    // Return the safe internal API path that redirects/serves the file
    return `/api/media/${uniqueKey}`;
  } catch (error) {
    console.error(`[R2] Error transferring file from Telegram to R2:`, error);
    return null;
  }
}
