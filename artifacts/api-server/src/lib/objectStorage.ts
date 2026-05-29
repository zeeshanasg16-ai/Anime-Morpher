import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { Readable } from "stream";

/**
 * Cloudflare R2 storage (S3-compatible).
 *
 * Required environment variables:
 *  - R2_ACCOUNT_ID         Cloudflare account id (the R2 endpoint subdomain)
 *  - R2_ACCESS_KEY_ID      R2 API token access key id
 *  - R2_SECRET_ACCESS_KEY  R2 API token secret access key
 *  - R2_BUCKET             R2 bucket name
 */

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} environment variable is required for object storage (Cloudflare R2).`,
    );
  }
  return value;
}

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const accountId = requireEnv("R2_ACCOUNT_ID");
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return cachedClient;
}

function getBucket(): string {
  return requireEnv("R2_BUCKET");
}

/** A lightweight handle to an object stored in R2. */
export interface StorageObject {
  key: string;
}

export class ObjectStorageService {
  constructor() {}

  /**
   * Generate a presigned PUT URL for a new upload and the canonical object
   * path the client should persist (and later use to fetch the object).
   */
  async getUploadUrl(
    contentType?: string,
  ): Promise<{ uploadURL: string; objectPath: string }> {
    const key = `uploads/${randomUUID()}`;
    const command = new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ...(contentType ? { ContentType: contentType } : {}),
    });
    const uploadURL = await getSignedUrl(getClient(), command, {
      expiresIn: 900,
    });
    return { uploadURL, objectPath: `/objects/${key}` };
  }

  /**
   * Resolve an object entity from a stored path like `/objects/uploads/<id>`.
   * Verifies the object exists; throws ObjectNotFoundError otherwise.
   */
  async getObjectEntityFile(objectPath: string): Promise<StorageObject> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const key = objectPath.slice("/objects/".length);
    if (!key) {
      throw new ObjectNotFoundError();
    }
    await this.assertExists(key);
    return { key };
  }

  /**
   * Look up a public asset by relative path. Public assets live under the
   * `public/` key prefix in the bucket.
   */
  async searchPublicObject(filePath: string): Promise<StorageObject | null> {
    const key = `public/${filePath}`.replace(/\/+/g, "/");
    try {
      await this.assertExists(key);
      return { key };
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        return null;
      }
      throw err;
    }
  }

  /** Stream an object's bytes back to the caller as a web Response. */
  async downloadObject(
    object: StorageObject,
    cacheTtlSec: number = 3600,
  ): Promise<Response> {
    let result;
    try {
      result = await getClient().send(
        new GetObjectCommand({ Bucket: getBucket(), Key: object.key }),
      );
    } catch (err) {
      if (isNotFound(err)) {
        throw new ObjectNotFoundError();
      }
      throw err;
    }

    const body = result.Body as Readable | undefined;
    if (!body) {
      throw new ObjectNotFoundError();
    }
    const webStream = Readable.toWeb(body) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": result.ContentType || "application/octet-stream",
      "Cache-Control": `private, max-age=${cacheTtlSec}`,
    };
    if (typeof result.ContentLength === "number") {
      headers["Content-Length"] = String(result.ContentLength);
    }

    return new Response(webStream, { headers });
  }

  private async assertExists(key: string): Promise<void> {
    try {
      await getClient().send(
        new HeadObjectCommand({ Bucket: getBucket(), Key: key }),
      );
    } catch (err) {
      if (isNotFound(err)) {
        throw new ObjectNotFoundError();
      }
      throw err;
    }
  }
}

function isNotFound(err: unknown): boolean {
  const e = err as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    e?.name === "NotFound" ||
    e?.name === "NoSuchKey" ||
    e?.$metadata?.httpStatusCode === 404
  );
}
