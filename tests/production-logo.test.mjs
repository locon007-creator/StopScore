import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const languageAssetPath = "/assets/us-language-reference.png";

async function productionWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("logo-test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

function productionEnvironment() {
  return {
    ASSETS: {
      fetch: async (request) => {
        const pathname = new URL(request.url).pathname;
        if (pathname !== languageAssetPath) return new Response("Not found", { status: 404 });
        const bytes = await readFile(new URL(`../dist/client${languageAssetPath}`, import.meta.url));
        return new Response(bytes, { status: 200, headers: { "Content-Type": "image/png" } });
      },
    },
  };
}

const context = { waitUntil() {}, passThroughOnException() {} };

test("production root directly serves the approved lightweight language asset", async () => {
  const worker = await productionWorker();
  const environment = productionEnvironment();
  const root = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), environment, context);
  assert.equal(root.status, 200);
  const html = await root.text();
  const languageAsset = html.match(/<img[^>]+us-language-reference\.png[^>]*>/)?.[0];
  assert.ok(languageAsset, "the production root must render the approved language asset");
  assert.match(languageAsset, /src="\/assets\/us-language-reference\.png"/);
  assert.doesNotMatch(languageAsset, /\/_vinext\/image/);
  assert.match(languageAsset, /width="36"/);
  assert.match(languageAsset, /height="36"/);
  assert.match(languageAsset, /alt=""/);

  const asset = await worker.fetch(new Request(`http://localhost${languageAssetPath}`), environment, context);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("content-type") ?? "", /^image\/png\b/i);
  const bytes = new Uint8Array(await asset.arrayBuffer());
  assert.ok(bytes.byteLength > 8, "the production language asset response must contain image bytes");
  assert.ok(bytes.byteLength <= 50_000, `the 36px language asset must stay lightweight; received ${bytes.byteLength} bytes`);
  assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
