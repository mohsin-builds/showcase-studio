# Showcase Studio

**An independent screen-recording editor.** Turn portfolio walkthroughs, website recordings, and product demonstrations into branded videos using a privacy-conscious, browser-based workflow.

## Product and brand

- Product name: **Showcase Studio** (independent customer-facing identity)
- Source repository: `mohsin-builds/showcase-studio` (to be created)
- Public home: a standalone `*.pages.dev` Cloudflare Pages project; **no custom domain or domain purchase planned at launch**
- Owner / copyright: Mohsin Labs. This is a separate product, not part of the `mohsin-os` application or Mohsin Tools repository.
- The existing Vercel preview is a temporary testing environment, not the long-term address.

## Functionality

- Upload MP4/WebM/MOV recordings as supported by the visitor's browser.
- Preview, scrub, trim in/out, and view thumbnails derived from footage.
- Edit text overlays, outro, brand name, optional logo, style, audio, and zoom.
- LinkedIn (4:5), portrait Reels/Shorts (9:16), or landscape (16:9) format presets.
- Standard and Full HD output choices, downloadable cover image, manual `.srt` caption export, and import/export of reusable JSON editing presets.
- No sign-in and no remote media uploads by the application itself. Hosting/CDN requests are still processed by the provider.

**Important:** Automatic AI captions/scene detection and universal direct H.264/AAC browser output are not implemented. Browser-generated MP4 can contain Opus audio, which may not be accepted by some platforms. Optional local conversion helpers are in `scripts/`, requiring an installed FFmpeg program.

## Development and testing

Requires Node.js 18+ for static checks/build, no npm installation or paid APIs.

```sh
node tests/verify.mjs
node scripts/build.mjs
node tests/verify-dist.mjs
```

For local interactive testing, serve the static project directory with a local HTTP server, then open the page in Chrome/Edge. Test with a **real recording** and inspect the exported streams before claiming social-platform compatibility.

## Deployment — Cloudflare Pages with GitHub

Create a new Cloudflare Pages project connected to this **independent GitHub repository**. Recommended configuration:

| Cloudflare Pages setting | Value |
|---|---|
| Framework | None |
| Production branch | `main` |
| Root directory | repository root |
| Build command | `node scripts/build.mjs` |
| Build output directory | `dist` |
| Environment variables | None required |

The repository deliberately excludes `dist/` from version control. Only nine user-facing assets are published by the build, not tests or scripts. Cloudflare will assign a unique `*.pages.dev` address after successful project creation. Do not attach `mohsinlabs.com` or purchase a domain for this release.

See `DEPLOYMENT.md` and `RELEASE_CHECKLIST.md` before launch.

## License and rights

Copyright © 2026 Mohsin Labs. All rights reserved. No reuse or redistribution license is granted by this repository unless separately approved.