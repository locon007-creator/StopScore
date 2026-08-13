export type PlaceSuggestion = {
  providerId: string;
  displayName: string;
  address: string;
  category: string;
  latitude: number;
  longitude: number;
};

export type PhotonSearchResult =
  | { kind: "results"; suggestions: PlaceSuggestion[] }
  | { kind: "empty"; suggestions: [] }
  | { kind: "unavailable"; code: "provider_unavailable" }
  | { kind: "rate_limited"; code: "budget_exhausted" };

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type Diagnostic = { event: "photon_attempt_failed"; attempt: number; reason: "network" | "status" | "payload"; status?: number };
type SearchOptions = {
  fetcher?: Fetcher;
  now?: () => number;
  log?: (entry: Diagnostic) => void;
  budgetLimit?: number;
  budgetWindowMs?: number;
  cacheTtlMs?: number;
};

const compact = (parts: Array<string | undefined>) => parts.filter(part => part && part.trim()).join(", ");
const normalizedQuery = (query: string) => query.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
const structuredPattern = /^\s*(\d+[a-z-]?)\s+([^,]+),\s*([^,]+),\s*([a-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?\s*$/i;

function common(endpoint: URL) {
  endpoint.searchParams.set("countrycode", "US");
  endpoint.searchParams.set("lang", "en");
  endpoint.searchParams.set("limit", "8");
  return endpoint;
}

export function buildPhotonAttempts(query: string): URL[] {
  const clean = query.trim().replace(/\s+/g, " ").slice(0, 140);
  if (clean.length < 3) return [];
  const direct = common(new URL("https://photon.komoot.io/api/"));
  direct.searchParams.set("q", clean);
  const attempts = [direct];
  const match = clean.match(structuredPattern);
  if (match) {
    const structured = common(new URL("https://photon.komoot.io/structured"));
    structured.searchParams.set("housenumber", match[1]);
    structured.searchParams.set("street", match[2]);
    structured.searchParams.set("city", match[3]);
    structured.searchParams.set("state", match[4]);
    if (match[5]) structured.searchParams.set("postcode", match[5]);
    attempts.push(structured);
  }
  const qualified = common(new URL("https://photon.komoot.io/api/"));
  qualified.searchParams.set("q", `${clean}, United States`);
  attempts.push(qualified);
  return attempts.slice(0, 3);
}

const osmTypes: Record<string, "node" | "way" | "relation"> = {
  N: "node", W: "way", R: "relation", node: "node", way: "way", relation: "relation",
};
const businessKeys = new Set(["amenity", "shop", "office", "industrial", "craft", "tourism", "building", "man_made"]);

type ParsedFeature = { kind: "malformed" } | { kind: "filtered" } | { kind: "suggestion"; suggestion: PlaceSuggestion };

function parseFeature(value: unknown): ParsedFeature {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { kind: "malformed" };
  const feature = value as Record<string, unknown>;
  if (!feature.properties || typeof feature.properties !== "object" || Array.isArray(feature.properties)) return { kind: "malformed" };
  if (!feature.geometry || typeof feature.geometry !== "object" || Array.isArray(feature.geometry)) return { kind: "malformed" };
  const properties = feature.properties as Record<string, unknown>;
  const geometry = feature.geometry as Record<string, unknown>;
  const osmId = properties.osm_id;
  const osmType = typeof properties.osm_type === "string" ? osmTypes[properties.osm_type] : undefined;
  if (!Number.isInteger(osmId) || (osmId as number) < 1 || !osmType || typeof properties.countrycode !== "string") return { kind: "malformed" };
  if (properties.countrycode.toUpperCase() !== "US") return { kind: "filtered" };
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) return { kind: "malformed" };
  const [longitude, latitude] = geometry.coordinates;
  if (typeof longitude !== "number" || typeof latitude !== "number" || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return { kind: "malformed" };
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return { kind: "malformed" };
  const text = (key: string) => typeof properties[key] === "string" && properties[key].trim() ? properties[key].trim() : undefined;
  const streetLine = [text("housenumber"), text("street")].filter(Boolean).join(" ");
  const city = text("city") ?? text("town") ?? text("village") ?? text("district") ?? text("county");
  const cityAndState = compact([city, text("state")]);
  const locality = [cityAndState, text("postcode")].filter(Boolean).join(" ");
  const address = compact([streetLine || undefined, locality || undefined]);
  const displayName = text("name") ?? streetLine;
  const osmKey = text("osm_key");
  const hasStreetAddress = Boolean(text("housenumber") && text("street"));
  const hasBusinessIdentity = Boolean(text("name") && osmKey && businessKeys.has(osmKey));
  if (!address || !displayName || (!hasStreetAddress && !hasBusinessIdentity)) return { kind: "filtered" };
  return {
    kind: "suggestion",
    suggestion: {
      providerId: `osm:${osmType}:${String(osmId)}`,
      displayName,
      address,
      category: text("type") ?? "place",
      latitude,
      longitude,
    },
  };
}

export function parsePhotonPayload(value: unknown): { ok: false } | { ok: true; suggestions: PlaceSuggestion[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false };
  const features = (value as Record<string, unknown>).features;
  if (!Array.isArray(features)) return { ok: false };
  const seen = new Set<string>();
  let wellFormedFeatures = 0;
  const suggestions = features.flatMap(entry => {
    const parsed = parseFeature(entry);
    if (parsed.kind === "malformed") return [];
    wellFormedFeatures += 1;
    if (parsed.kind === "filtered" || seen.has(parsed.suggestion.providerId)) return [];
    seen.add(parsed.suggestion.providerId);
    return [parsed.suggestion];
  });
  if (features.length > 0 && wellFormedFeatures === 0) return { ok: false };
  return { ok: true, suggestions };
}

export function createPhotonSearchService(options: SearchOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const log = options.log ?? (entry => console.warn(JSON.stringify(entry)));
  const budgetLimit = options.budgetLimit ?? 20;
  const budgetWindowMs = options.budgetWindowMs ?? 60_000;
  const cacheTtlMs = options.cacheTtlMs ?? 30_000;
  const inFlight = new Map<string, Promise<PhotonSearchResult>>();
  const cache = new Map<string, { expiresAt: number; result: PhotonSearchResult }>();
  let budgetWindowStartedAt = now();
  let budgetUsed = 0;

  function reserve(attempts: number) {
    const current = now();
    if (current - budgetWindowStartedAt >= budgetWindowMs) {
      budgetWindowStartedAt = current;
      budgetUsed = 0;
    }
    if (budgetUsed + attempts > budgetLimit) return false;
    budgetUsed += attempts;
    return true;
  }

  async function execute(attempts: URL[]): Promise<PhotonSearchResult> {
    const payloads = await Promise.all(attempts.map(async (endpoint, attempt) => {
      try {
        const response = await fetcher(endpoint, { headers: { Accept: "application/json" } });
        if (!response.ok) {
          log({ event: "photon_attempt_failed", attempt, reason: "status", status: response.status });
          return null;
        }
        let body: unknown;
        try { body = await response.json() as unknown; } catch {
          log({ event: "photon_attempt_failed", attempt, reason: "payload" });
          return null;
        }
        const parsed = parsePhotonPayload(body);
        if (!parsed.ok) {
          log({ event: "photon_attempt_failed", attempt, reason: "payload" });
          return null;
        }
        return parsed.suggestions;
      } catch {
        log({ event: "photon_attempt_failed", attempt, reason: "network" });
        return null;
      }
    }));
    const validPayloads = payloads.filter((payload): payload is PlaceSuggestion[] => payload !== null);
    if (validPayloads.length === 0) return { kind: "unavailable", code: "provider_unavailable" };
    const seen = new Set<string>();
    const suggestions = validPayloads.flat().filter(place => !seen.has(place.providerId) && seen.add(place.providerId)).slice(0, 8);
    return suggestions.length ? { kind: "results", suggestions } : { kind: "empty", suggestions: [] };
  }

  return {
    search(query: string): Promise<PhotonSearchResult> {
      const key = normalizedQuery(query);
      const attempts = buildPhotonAttempts(query);
      if (!attempts.length) return Promise.resolve({ kind: "empty", suggestions: [] });
      const currentTime = now();
      for (const [cacheKey, entry] of cache) {
        if (entry.expiresAt <= currentTime) cache.delete(cacheKey);
      }
      const cached = cache.get(key);
      if (cached) return Promise.resolve(cached.result);
      const existing = inFlight.get(key);
      if (existing) return existing;
      if (!reserve(attempts.length)) return Promise.resolve({ kind: "rate_limited", code: "budget_exhausted" });
      const request = execute(attempts).then(result => {
        if (result.kind === "results" || result.kind === "empty") cache.set(key, { expiresAt: now() + cacheTtlMs, result });
        return result;
      }).finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
      inFlight.set(key, request);
      return request;
    },
    cacheSize() {
      return cache.size;
    },
  };
}

export const photonSearch = createPhotonSearchService();
