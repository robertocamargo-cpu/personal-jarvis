import { cp, mkdir, writeFile } from "node:fs/promises";

await mkdir(new URL("./dist/", import.meta.url), { recursive: true });
await cp(new URL("./site/", import.meta.url), new URL("./dist/", import.meta.url), { recursive: true });
await writeFile(new URL("./dist/status.json", import.meta.url), JSON.stringify({
  service: "personal-jarvis-cloud",
  stage: "deployment-foundation",
  commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
  built_at: new Date().toISOString(),
  capabilities: { remote_chat: false, remote_voice: false, cloud_database: false },
}, null, 2));
