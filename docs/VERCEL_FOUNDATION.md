# GitHub and Vercel foundation

The user authorized GitHub/Vercel integration on 2026-09-06. `cloud/` is the
deployment root. The initial static Node 22 status page was subsequently
replaced by a Next.js application with a Portuguese account surface. Its public
manifest contains only the commit ID and unavailable remote capabilities.

This is a deployment foundation, not the complete Jarvis cloud runtime. The
native server still depends on local audio, processes, filesystem state and
in-process sessions. Publishing the full desktop composition as a stateless
function would not establish those capabilities. The cloud page explicitly says
that chat, voice and history migration remain to be completed. The account
foundation is implemented but login activation still needs callback setup;
see `CLOUD_AUTH.md`.

No local configuration, provider credential, conversation, database or desktop
tool endpoint is deployed. Microphone/camera access is disabled on this status
page. The existing Mac UI and Gemini 2.5 Native Audio selection remain independent.

GitHub repository: `robertocamargo-cpu/personal-jarvis` (the user's fork, not
`PersonalJarvis/PersonalJarvis`). Vercel team: `robertocamargo-cpu`. Use the
`cloud` root directory, `npm run build`, automatic output, framework Next.js.

## Verified deployment on 2026-09-06

T1 local: deployment status copy, delivery evidence and local secret exclusions.

- Production address: https://jarvis-bob.vercel.app (verified project domain).
- Vercel project: `personal-jarvis`, ID `prj_Gh21fKo0XmCoXPjDDVtIeTYDVwUu`.
- GitHub production branch: `main`; initial deployment from `6dbc765170c651a4007885be8f43532db6c981d2` reached READY.
- Neon resource: `jarvis-db`, Free plan `free_v3`, region `gru1`, provisioned through Vercel Marketplace and linked to the production environment.
- A read-only PostgreSQL connection and `SELECT 1` succeeded. Client TLS was confirmed through libpq; the proxy backend's `pg_stat_ssl` is not the client TLS indicator.
- Credentials are managed as Vercel environment variables, never included in the static site. The temporary verification credential export is deleted after use.

The public manifest still reports `cloud_database: false`: the deployed static
application does not query the database yet. Provisioning does not establish
application authentication, migrate history or enable remote control.

Next: add authenticated cloud routes and owner mapping, test migration on a
disposable branch, then connect the frontend and the authenticated local bridge.
