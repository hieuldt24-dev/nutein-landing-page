<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project docs — read before working on Nutein

This project keeps its architecture/style/state rulebook in `docs/`. Before making changes, read the doc(s) relevant to the task — do not skip this even if the request looks small.

- Editing `app/`, `features/`, `src/`, `lib/`, adding a route/API/feature, or unsure where a file belongs → read [docs/source-code-architecture-guide.md](docs/source-code-architecture-guide.md) first.
- Editing any UI/component, CSS, Tailwind classes, colors, spacing, or anything under `components/` → read [docs/frontend-style-system-guide.md](docs/frontend-style-system-guide.md) first. If the task is specifically about the ongoing visual rebrand (Nutein color/token migration, drinkjoyrush.com-inspired sections), also read [docs/frontend-style-overhaul.md](docs/frontend-style-overhaul.md).
- Adding/modifying state (`useState`, SWR, forms, cart/checkout state, anything cross-component) → read [docs/state-management.md](docs/state-management.md) first.
- Adding/modifying any loading/skeleton/spinner/async-submit behavior → read [docs/loading-agent-guide.md](docs/loading-agent-guide.md) first.

These docs are project-specific and override generic Next.js/React conventions from training data when they conflict.
