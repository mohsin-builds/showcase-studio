# Showcase Studio — Permanent deployment

## 1. Independent repository (GitHub)

Create repository `mohsin-builds/showcase-studio`. Do not check “Add README”, “Add .gitignore”, or “Choose a license”; the source package already provides the first two and no open-source license has been approved. The repository can be private while the app remains publicly accessible; you can decide later whether to make the source public. After creating it, provide the exact repository link so the latest source can be committed through the connected GitHub tools.

## 2. Connect Cloudflare Pages to GitHub

Cloudflare dashboard → **Compute → Workers & Pages → Create application → Pages → Import an existing Git repository** (button names may vary). Select `mohsin-builds/showcase-studio` and use:

- Project name: `showcase-studio` if available, else `showcase-studio-app` or another available name.
- Production branch: `main`.
- Framework: None.
- Build command: `node scripts/build.mjs`.
- Build output directory: `dist`.
- Root directory: repository root.
- No variables, tokens or paid services needed for the static version.

Connect through Cloudflare's OAuth prompt rather than sharing GitHub credentials, tokens, or Cloudflare API keys in chat. Cloudflare chooses the actual `*.pages.dev` hostname; verify it on the deployment screen. Do not set a custom domain or edit DNS.

**Important:** Use Git integration for this new project. A Pages project created using dashboard Direct Upload cannot later be switched to Git integration. When connected, pushing to `main` triggers production deployments. Keep the existing Vercel preview until the Cloudflare address is verified.

## 3. Launch verification

- Homepage loads securely over HTTPS with source, styles, icon, and sample clip.
- Chrome and Edge can upload a short recording and preview it.
- Controls: play/pause, trims, style, brand logo, audio, aspect ratios, caption and cover export.
- Export a real file; inspect codecs and upload a test clip to the intended social platform before saying “ready for every platform.”
- Test mobile layout and keyboard navigation; review privacy policy and browser limitations.
- After a successful launch, store the actual Cloudflare URL and verification date in Mohsin Labs OS Product Studio.

The `pages.dev` address is the free initial product identity. A dedicated purchased domain is a later decision based on verified traction, not a launch requirement.