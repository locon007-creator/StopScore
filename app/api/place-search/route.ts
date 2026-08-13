import { getChatGPTUser } from "../../chatgpt-auth";
import { createPlaceSearchHttpHandler } from "../../v2/server/place-search-http.ts";
import { photonSearch } from "../../v2/server/place-search.ts";

export const GET = createPlaceSearchHttpHandler({
  authenticate: async () => {
    const user = await getChatGPTUser();
    return user ? { email: user.email } : null;
  },
  search: query => photonSearch.search(query),
});
