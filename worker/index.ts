// The one server piece: POST /api/recognize. Everything else is the static app.
export interface Env {
  ASSETS: Fetcher;
  RECOGNIZE_LIMIT: RateLimit;
  MODEL: string;
  RELAY_URL?: string;
  RELAY_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/recognize") {
      return Response.json({ error: "Photo recognition isn't set up yet. Add items by hand." }, { status: 501 });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
