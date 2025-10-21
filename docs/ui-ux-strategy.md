# UI/UX Strategy - E-commerce Platform

## Vision
- Consolidate a unified visual language across storefront and admin inspired by Shopify: minimalist layouts, generous white space, high-contrast CTAs, and data-rich dashboards.
- Prioritise quick discovery for shoppers (guided navigation, merchandising highlights) and operational clarity for admins (status-at-a-glance, streamlined workflows).

## Design System Foundations
- **Brand palette:**
  - Primary `#0f766e` (teal) for brand elements and CTAs
  - Secondary `#111827` (near-black) for typography emphasis
  - Support neutrals `#f8fafc`, `#e2e8f0`, `#cbd5f5` for surfaces and borders
  - Accent `#f97316` for promotions/alerts
- **Typography:** Use `Inter` for UI, `Playfair Display` for premium headlines. Establish base size 16px with responsive scale.
- **Spacing & elevation:** 8px spacing grid, soft shadows for cards (`shadow-lg`, `shadow-sm`), rounded corners `rounded-2xl` for hero and feature elements.
- **Components:** Define reusable primitives (stat cards, section headers, pill badges, glass cards, action buttons).

## User Storefront Enhancements
1. **Global navigation**
   - Compact announcement bar with promotions.
   - Sticky top navigation combining search, account, wishlist/cart shortcuts with inline badges.
   - Mega-menu interactions with smooth transitions and featured merchandising tiles.
2. **Homepage flow**
   - Hero with split layout (value prop + visual), gradient background, dual CTA (comprar/explorar).
   - Merchandising rails (destacados, categorias) using large cards, descriptive copy, consistent iconography.
   - Social proof section (testimonials/metrics) and service guarantees (envios, devoluciones, soporte).
   - Cart & checkout: order summary highlighting savings, shipping info, trust badges.
3. **Product browsing**
   - Filterable collections with pill filters, skeleton loaders, and persistent sort controls.
   - Product cards with hover states, clear pricing/discount messaging, quick add-to-cart CTA.

## Admin Experience Enhancements
1. **Layout**
   - Persistent sidebar with brand area and active state highlights; collapsible for tablet.
   - Topbar providing quick search, notifications, profile menu, and primary CTA (crear producto).
2. **Dashboard**
   - KPI grid with spark indicators (delta vs. previous periodo).
   - Revenue trend chart with range selector (7/30/90 dias) and legend.
   - Recent orders and top products tables with status badges and quick actions.
3. **Workflows**
   - Product, categories, and orders pages adopt a consistent layout: filters panel, primary action bar, content table/cards.
   - Use inline toasts and confirmation modals for destructive actions.
4. **Design tokens**
   - Shared utility classes for cards, tables, filter pills, status badges to reduce duplication and enforce consistency.

## Implementation Roadmap
1. Extend Tailwind config (colors, fonts) and apply base layer styles in `index.css`.
2. Refactor admin navigation (sidebar + topbar) to new component architecture.
3. Rebuild homepage hero + promotional sections with gradient backgrounds, stats strip, updated copy.
4. Introduce reusable UI primitives (`SectionHeading`, `StatCard`, `BadgePill`) and apply across storefront/admin.
5. Polish typography and copy (consistent casing, accent corrections), add responsive refinements for mobile/tablet.
