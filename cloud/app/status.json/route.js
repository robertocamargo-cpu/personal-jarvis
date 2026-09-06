import { chatConfiguration } from "../../lib/chat/policy.mjs";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({
    service: "personal-jarvis-cloud",
    stage: "cloud-text-chat",
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    capabilities: { remote_chat: Boolean(chatConfiguration()), remote_voice: false, cloud_database: Boolean(chatConfiguration()) },
  }, { headers: { "Cache-Control": "no-store" } });
}
