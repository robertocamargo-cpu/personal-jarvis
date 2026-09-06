export function GET() {
  return Response.json({
    service: "personal-jarvis-cloud",
    stage: "account-foundation",
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    capabilities: { remote_chat: false, remote_voice: false, cloud_database: false },
  }, { headers: { "Cache-Control": "no-store" } });
}
