# Mobile installation foundation

T2, cloud browser surface only: the existing Next.js application now provides
a Web App Manifest, standalone display, a home-screen installation guide and
an optional native install prompt. Desktop Python startup, authentication
contracts, provider selection and local history remain unchanged.

`/instalar` provides Brazilian Portuguese instructions for iOS Safari and
Android Chrome. The install button is shown only after the browser supplies
`beforeinstallprompt`; installation completion is not inferred from a click.
The browser's `appinstalled` event and standalone display mode determine the
installed state. Manual browser-menu instructions remain available otherwise.

The generated 180/192/512 PNG icons use the application's JB monogram. The
manifest keeps `id`, `scope` and `start_url` on the same origin and launches the
public home page. No login token, personal URL or device identifier is embedded.

No offline service worker, background task, push subscription, microphone
permission request or cache of personal data is introduced. Installation does
not activate Google login, chat, voice, approvals or a local bridge. Those are
separate capabilities and the installation page states their pending status.

Verification: production build and `cloud/tests/pwa-http.mjs` check the linked
manifest, icon bytes/dimensions and served installation guide. Browser navigation
is checked separately. Actual installation on a physical phone remains user
acceptance; no simulated viewport is described as a real phone test.

Reference: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).
