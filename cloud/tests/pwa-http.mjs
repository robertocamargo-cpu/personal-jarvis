import assert from "node:assert/strict";

const base = process.env.JARVIS_CLOUD_TEST_URL;
if (!base) throw new Error("JARVIS_CLOUD_TEST_URL is required");
const response = await fetch(new URL("/manifest.webmanifest", base));
assert.equal(response.status, 200);
const manifest = await response.json();
assert.equal(manifest.display, "standalone");
assert.equal(manifest.lang, "pt-BR");
assert.equal(manifest.start_url, "/");
assert.equal(manifest.scope, "/");
assert.equal(manifest.prefer_related_applications, false);
for (const size of [180, 192, 512]) {
  const icon = await fetch(new URL(`/pwa-icon/${size}`, base));
  assert.equal(icon.status, 200);
  assert.match(icon.headers.get("content-type"), /image\/png/);
  const png = Buffer.from(await icon.arrayBuffer());
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}
const home = await (await fetch(new URL("/", base))).text();
assert.match(home, /rel="manifest"/);
assert.match(home, /apple-touch-icon/);
const page = await (await fetch(new URL("/instalar", base))).text();
assert.match(page, /Adicionar à Tela de Início/);
assert.match(page, /Instalar aplicativo/);
console.log("PWA HTTP checks passed: linked manifest, standalone scope, PNG dimensions and mobile instructions.");
