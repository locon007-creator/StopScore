import type { PhotonSearchResult } from "./place-search.ts";

type Dependencies = {
  authenticate: () => Promise<{ email: string } | null>;
  search: (query: string) => Promise<PhotonSearchResult>;
};

export function createPlaceSearchHttpHandler(dependencies: Dependencies) {
  return async (request: Request) => {
    const user = await dependencies.authenticate();
    if (!user) {
      return Response.json(
        { error: { code: "unauthenticated", message: "Sign in to search for places." } },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 3 || query.length > 140) return Response.json({ kind: "empty", suggestions: [] }, { headers: { "Cache-Control": "no-store" } });
    const result = await dependencies.search(query);
    if (result.kind === "rate_limited") return Response.json(result, { status: 429, headers: { "Cache-Control": "no-store" } });
    if (result.kind === "unavailable") return Response.json(result, { status: 503, headers: { "Cache-Control": "no-store" } });
    return Response.json(result, { headers: { "Cache-Control": "private, max-age=30" } });
  };
}
