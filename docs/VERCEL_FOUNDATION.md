# GitHub and Vercel foundation

The user authorized GitHub/Vercel integration on 2026-09-06. `cloud/` is the
deployment root. Its dependency-free Node 22 build publishes a Portuguese
installation status page and a small public deployment manifest containing only
the commit ID, build time and currently unavailable remote capabilities.

This is a deployment foundation, not the complete Jarvis cloud runtime. The
native server still depends on local audio, processes, filesystem state and
in-process sessions. Publishing the full desktop composition as a stateless
function would not establish those capabilities. The cloud page explicitly says
that chat, voice, login and database connectivity remain to be completed.

No local configuration, provider credential, conversation, database or desktop
tool endpoint is deployed. Microphone/camera access is disabled on this status
page. The existing Mac UI and Gemini 2.5 Native Audio selection remain independent.

GitHub repository: `robertocamargo-cpu/personal-jarvis` (the user's fork, not
`PersonalJarvis/PersonalJarvis`). Vercel team: `robertocamargo-cpu`. Use the
`cloud` root directory, `npm run build`, output `dist`, framework Other.

Next: provision/link the designated database through Vercel Marketplace, add
authenticated cloud routes and owner mapping, test migration on a disposable
branch, then connect the frontend and the authenticated local bridge.
