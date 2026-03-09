# PDRL HTML/CSS/JS Rebuild - Development Plan

## Design Guidelines
- **Theme**: Dark racing theme matching existing React app
- **Primary Background**: #0b0d10
- **Card Background**: rgba(17, 24, 39, 0.7) (gray-900/70)
- **Border Color**: #374151 (gray-700)
- **Accent Red**: #dc2626 (red-600)
- **Text Primary**: #ffffff
- **Text Secondary**: #d1d5db (gray-300)
- **Font**: System fonts (Inter, -apple-system, etc.)

## Architecture
- All HTML files go in `/workspace/app/frontend/public/`
- Shared CSS: `/workspace/app/frontend/public/styles.css`
- Shared JS utilities: `/workspace/app/frontend/public/app.js` (auth, API helpers, nav)
- Each page is a standalone HTML file using fetch() for API calls
- Auth via JWT stored in localStorage, sent as Bearer token
- Backend remains completely untouched

## Files to Create (8 file limit)

1. **styles.css** - Complete CSS for all pages (dark theme, responsive, components)
2. **app.js** - Shared JS: auth management, API helpers, header/footer rendering, utilities
3. **index.html** - Homepage with hero, next event, flyer, quick links
4. **events.html** - Events listing page with event cards, links to results
5. **event-results.html** - Race results for a specific event (?eventId=X)
6. **leaderboard.html** - Driver rankings with year/class/event filters
7. **register.html** - Registration form (requires login)
8. **admin.html** - Admin dashboard with tabs (events, registrations, race times, import, admins, migration)

## Pages NOT built (lower priority, can be added later)
- driver-profile.html (linked from leaderboard)
- classes.html, rules.html, about.html, contact.html, media.html, garage.html
- These are mostly static content pages that can be added incrementally

## Auth Flow
- Login: redirect to `/api/v1/auth/login` (OIDC flow)
- Callback: `/auth/callback` page reads token from URL params, stores in localStorage
- API calls: include `Authorization: Bearer <token>` header
- Logout: call `/api/v1/auth/logout`, clear localStorage

## API Endpoints Used
- Public: `/api/v1/public/events`, `/api/v1/public/flyer-url`
- Public: `/api/v1/registrations/public`, `/api/v1/entities/race_times/all`
- Public: `/api/v1/driver/profile?driver_name=X`, `/api/v1/driver/search?q=X`
- Auth: `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/logout`
- Auth required: `/api/v1/registrations`, `/api/v1/admin/*`
- Auth required: `/api/v1/entities/events` (CRUD), `/api/v1/entities/race_times` (CRUD)
- Auth required: `/api/v1/race-data-import/parse-dat`, `/api/v1/race-data-import/import`
- Auth required: `/api/v1/migration/add-race-times-fields`