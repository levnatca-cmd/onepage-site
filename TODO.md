# TODO

**Last updated:** 2026-04-21
**Branch:** `feat/conversion-v1`
**Status:** 30 active tasks + backlog of 31 advanced ideas

---

## Needs from user (blockers)

These tasks cannot start until the user provides data or makes a decision.

- [ ] Real name, LinkedIn URL, GitHub URL (blocks #3, #4, #6, #7)
- [ ] 2-3 case study records: client type / constraint / problem / approach / stack / result / duration (blocks #8, #9)
- [ ] 2 testimonial quotes with sources (blocks #10, #11)
- [ ] Real tech stacks used per service domain (blocks #14)
- [ ] Decision: Cal.com embed vs Cloudflare-Worker-proxy form vs mailto-only (blocks #19, #20)
- [ ] Hosting platform choice: Cloudflare Pages / Netlify / Vercel / GitHub Pages (blocks #26, #27)
- [ ] Web3Forms access key — only if proxy/form strategy chosen
- [ ] Plausible Analytics account (or Umami self-hosted) signup
- [ ] Google Search Console property signup
- [ ] Google Business Profile signup (Toronto GTA, Engineering consultant + Software company)
- [ ] Bing Webmaster Tools signup
- [ ] og-image.png design asset (1200x630)
- [ ] Favicon compression (tool choice + execution)

---

## Iteration A — Assets and identity (P0)

- [ ] 1. Compress `Favicon2.png` to ≤10KB (currently 647KB — critical LCP blocker)
- [ ] 2. Delete unused `head_background.png` (1.77MB) from repo
- [ ] 3. Collect founder name, LinkedIn, GitHub from user
- [ ] 4. Update Person schema: replace placeholder name, add `sameAs` array
- [ ] 5. Create `og-image.png` (1200x630) + add `og:image` and `twitter:image` meta tags, upgrade `twitter:card` to `summary_large_image`

## Iteration B — Trust signals (P0)

- [ ] 6. Write About me section copy (name, years, specialty, location)
- [ ] 7. Add About me section HTML + CSS between hero and problems
- [ ] 8. Collect case study data for 2-3 real projects
- [ ] 9. Add case studies section (new section between services and positioning) with HTML + CSS
- [ ] 10. Collect 2 testimonial quotes with honest source labels
- [ ] 11. Add testimonials section (HTML + CSS, re-adding the `.testimonials` grid)

## Iteration C — Content polish (P1)

- [ ] 12. Remove "Social Media as a System" service card — dilutes positioning
- [ ] 13. Rewrite service card closings with concrete deliverables lists
- [ ] 14. Add tech stack names to each service card (React, ESP32, AWS, etc.)
- [ ] 15. Add `Output:` line per process step (artifact the client receives)
- [ ] 16. Write 6 FAQ question/answer pairs
- [ ] 17. Add FAQ section using native `<details>/<summary>` + matching CSS

## Iteration D — Mobile and contact UX (P1)

- [ ] 18. Add mobile hamburger navigation (HTML + CSS + JS with aria-expanded)
- [ ] 19. Decide contact strategy: Cal.com embed vs Cloudflare-Worker-proxy form vs mailto-only
- [ ] 20. Implement chosen contact strategy

## Iteration E — Analytics and SEO ops (P1)

- [ ] 21. Sign up for Plausible Analytics and add one-line script tag to `<head>`
- [ ] 22. Create Google Search Console property and verify ownership (uncomment verification meta in `<head>`)
- [ ] 23. Submit `sitemap.xml` to Google Search Console
- [ ] 24. Create Google Business Profile for Toronto GTA
- [ ] 25. Sign up for Bing Webmaster Tools and submit site

## Iteration F — Deployment (P0 for launch)

- [ ] 26. Choose hosting platform (recommendation: Cloudflare Pages)
- [ ] 27. Create deploy config, connect git repo, configure `levnat.ca` domain
- [ ] 28. Add production security headers: CSP, HSTS, X-Frame-Options, Referrer-Policy
- [ ] 29. Run production smoke tests: Rich Results, LinkedIn Post Inspector, PageSpeed Insights, Mobile-Friendly

## Iteration G — Legal (P2)

- [ ] 30. Write minimal Privacy Policy (`/privacy.html`) + add footer link

---

## Backlog — Advanced ideas (Tier 1-7)

Evaluated but not yet scoped as active tasks. Pick from these after the 30 above.

### Tier 1 — Authority and content marketing (highest ROI)

- [ ] Signature methodology name (e.g. "7-Day Systems Audit") — memorable, ownable
- [ ] `/now` page — monthly update on current work
- [ ] Open-source tool/repo relevant to target audience (1 weekend project)
- [ ] Technical blog with 3 initial posts (firmware, CI/CD, debugging postmortems)
- [ ] Lead magnet PDF: "Engineering Debt Audit Checklist" or similar

### Tier 2 — Memorable differentiation

- [ ] "What I don't do" section (contrarian, anti-agency signal)
- [ ] Public next availability ("Next project slot: June 2026") via Cal.com or manual
- [ ] Founder letter / manifesto page
- [ ] Comparison table: Solo engineer vs Agency vs Me
- [ ] Intake questionnaire (8 questions) replacing or augmenting contact form

### Tier 3 — Technical polish (engineer-bait)

- [ ] Self-host fonts + glyph subset (WOFF2, sub-50KB)
- [ ] Service worker / PWA (installable, offline fallback)
- [ ] `prefers-color-scheme: light` mode
- [ ] `security.txt` at `/.well-known/security.txt` (RFC 9116)
- [ ] `humans.txt` at project root
- [ ] DevTools `console.log` easter egg with ASCII art + contact invitation
- [ ] Lighthouse CI in GitHub Actions (fail PR on Performance <90)

### Tier 4 — Advanced SEO / discoverability

- [ ] `FAQPage` schema.org JSON-LD for FAQ section (rich snippets)
- [ ] `BreadcrumbList` schema for anchor navigation
- [ ] `Article` schema per blog post (after blog launched)
- [ ] `hreflang="fr-CA"` tag + minimal French version
- [ ] Backlink outreach plan (Show HN, r/embedded, indiehackers, LinkedIn)

### Tier 5 — Conversion psychology

- [ ] Plausible event tracking: CTA clicks, scroll depth, section visibility
- [ ] A/B test hero headline (2 variants + Plausible conversion tracking)
- [ ] Microsoft Clarity heatmap (free, no cookies needed)
- [ ] Loss-aversion framing in service card copy
- [ ] Testimonial carousel with photos (once 4+ testimonials collected)

### Tier 6 — Operations and reliability

- [ ] Public status page (BetterUptime / UptimeRobot free tier)
- [ ] Visual regression tests (Playwright screenshot-diff in CI)
- [ ] DNS security records: SPF, DKIM, DMARC for `@levnat.ca`

### Tier 7 — Localization

- [ ] Full French version for Canadian bilingual / Quebec market reach

---

## Completed

Track completed items by removing them from the list above and optionally noting them in git commits.

Current branch `feat/conversion-v1` so far has implemented:
- Rewrote hero with outcome-driven headline
- Added "If this sounds familiar" problems section (4 pain-voice cards)
- Built and then removed Web3Forms contact form (replaced with mailto-only)
- Consolidated CTAs to single primary + single secondary pattern
- Added full SEO meta stack: robots, theme-color, color-scheme, canonical, OG, Twitter
- Replaced CSS `@import` with preconnect + stylesheet link for fonts
- Added static JSON-LD `@graph` schema with WebSite, ProfessionalService, Person nodes
- Restructured with `<header>`, `<main id="main-content">`, skip link, aria-labelledby on sections
- Wrapped service/problem cards in `<article>`, contact in `<address>`
- Added `:focus-visible` styles, WCAG 2.2 AA improvements
- Added `prefers-reduced-motion` guard for flicker animation
- Fixed iOS zoom on input focus (16px font-size)
- Disabled expensive body pseudo-elements on mobile
- Introduced `SITE_CONFIG` single source of truth
- JSDoc comments on all JS functions
- Dynamic copyright year
- Created `robots.txt` and `sitemap.xml`
- Improved title + meta description for Toronto + consultant keywords
- Removed contact form entirely and all related dead CSS/JS (~400 lines cleaned)
