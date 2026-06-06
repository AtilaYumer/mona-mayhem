# Copilot Instructions

## Design Guide: Retro Arcade Theme

Use this visual direction for all UI and styling decisions on Mona Mayhem.

### Color System

- Background base: `#0a0a1a`
- Primary accent (neon green): `#5fed83`
- Secondary accent (arcade purple): `#8a2be2`
- Text on dark backgrounds: high-contrast off-white and soft lavender/blue-gray support tones.
- Keep the page dark-first; green and purple should be used as highlights, glows, borders, and animated accents.
- Avoid introducing unrelated accent palettes that dilute the retro arcade identity.

### Typography

- Primary display/body font: **Press Start 2P** (Google Fonts).
- Keep typography compact, punchy, and game-UI inspired.
- Use larger title treatment with glow effects; keep supporting text readable with balanced spacing and contrast.

### Animation Style

- Overall motion language: retro neon arcade, energetic but controlled.
- Preferred effects:
  - CRT/scanline ambient background treatment
  - Neon pulse/flicker on key headings
  - Gradient-shift and pulse emphasis for versus elements
  - Subtle shimmer/shine on result cards
  - Float-in/staggered reveal for form controls
  - Color-shifting loading states between green and purple
  - Hover glow on contribution grid cells
- Use transform/opacity-based animations where possible for smooth performance.
- Respect accessibility: include reduced-motion fallbacks (`prefers-reduced-motion`) for non-essential animations.

### Implementation Notes

- Preserve responsiveness across desktop and mobile.
- Prefer reusable CSS custom properties for colors, shadows, animation speed, and easing.
- New UI additions should match this theme unless a task explicitly requests a different style.
