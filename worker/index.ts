// The one server piece: POST /api/recognize. Everything else is the static app.
import { recognize } from "./recognize";

export interface Env {
  ASSETS: Fetcher;
  RECOGNIZE_LIMIT: RateLimit;
  MODEL: string;
  RELAY_URL?: string;
  RELAY_KEY?: string;
}

const MAX_IMAGE_CHARS = 4_000_000; // a 1280-px JPEG is far smaller; this only stops abuse

const fail = (status: number, error: string) => Response.json({ error }, { status });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api/recognize") return env.ASSETS.fetch(request);
    if (request.method !== "POST") return fail(405, "Use POST.");
    if (!env.RELAY_URL || !env.RELAY_KEY) return fail(503, "Photo recognition isn't set up here. Add items by hand.");

    const visitor = request.headers.get("cf-connecting-ip") ?? "local";
    const { success } = await env.RECOGNIZE_LIMIT.limit({ key: visitor });
    if (!success) return fail(429, "Too many photos in a minute. Wait a moment, or add items by hand.");

    let image: unknown;
    try {
      image = ((await request.json()) as { image?: unknown }).image;
    } catch {
      return fail(400, "That wasn't a photo.");
    }
    if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_IMAGE_CHARS) {
      return fail(400, "That wasn't a photo the app can read.");
    }

    try {
      return Response.json({ items: await recognize(image, env) });
    } catch (error) {
      console.error("recognize failed", error instanceof Error ? error.message : error);
      const slow = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      return fail(502, slow ? "Reading the photo took too long. Try again, or add items by hand." : "Couldn't read this photo. Try again, or add items by hand.");
    }
  },
} satisfies ExportedHandler<Env>;
