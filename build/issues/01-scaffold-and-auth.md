# 01 — Project Scaffold + Password Protection

**What to build:** A fresh Next.js App Router project with Tailwind CSS, deployed to the existing Vercel project. Every route is protected by a password middleware — unauthenticated requests are redirected to a login screen. Once authenticated, a session cookie is set. The app shell is mobile-first with a safe-area-aware layout.

**Blocked by:** None — can start immediately.

- [ ] Wipe existing knowledge_garden repo contents
- [ ] Scaffold Next.js App Router + Tailwind into the repo
- [ ] Implement password middleware using `SITE_PASSWORD` env var
- [ ] Build minimal login screen (password input, submit)
- [ ] Set session cookie on successful auth, clear on logout
- [ ] Configure PWA manifest (name, icon, display: standalone, theme colour)
- [ ] Deploy to existing Vercel project with env vars: `SITE_PASSWORD`, `GITHUB_PAT`, `GITHUB_REPO`
- [ ] Confirm app loads on iPhone via Vercel URL
