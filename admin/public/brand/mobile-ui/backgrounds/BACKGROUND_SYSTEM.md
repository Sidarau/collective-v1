# Mobile Background and Depth System

These backgrounds provide atmosphere, spatial continuity and route identity.
They must never become the primary content. The interface remains a serious
operations tool, not a cinematic showcase.

## Page mapping

| Background | Use on |
|---|---|
| Forest Light | Today and the continuous past/future timeline |
| Glass Halo | Requests, Gates, People and access details |
| Champagne Satin | Dues, expenses, contributions, budgets and transactions |
| Marine Refraction | Spaces, boats, land, venues and Experiences |

Detail screens inherit their parent background. Do not generate a unique
wallpaper for every record or Space type. The family should feel stable as the
operator moves through the app.

## iPhone home-to-lock behavior

Use one master image per route family and create the visual states in CSS:

1. **Overview:** image at `scale(1.08)`, sharp, low-opacity chroma veil.
2. **Scrolled:** move the image by at most 24 px over the entire page, add up to
   4 px blur, and gently darken it. The background should appear to recede while
   the timeline remains continuous beneath the translucent header.
3. **Detail or modal focus:** ease to `scale(1.04)`, add 12 px blur and a dark
   veil. This creates the iOS lock-screen notification effect behind sheets.
4. **Return:** remove blur and return to the previous scroll-derived position.
   Preserve scroll state; do not snap the wallpaper or timeline.
5. **Route family change:** hold the outgoing image while the incoming image
   crossfades underneath it. Apply a brief 0 → 6 → 0 px blur during the
   700 ms transition so the swap reads as optical focus, not a slideshow.

Do not use constant autonomous motion. Motion is caused only by navigation,
scroll, opening a sheet or a deliberate pointer movement.

## Layer recipe

```tsx
<div className="ambient-scene" aria-hidden="true">
  <picture className="ambient-scene__picture">
    <source srcSet={background.webp} type="image/webp" />
    <img src={background.png} alt="" decoding="async" />
  </picture>
  <div className="ambient-scene__chroma" />
  <div className="ambient-scene__veil" />
</div>
```

The scene is decorative and must be removed from the accessibility tree.

```css
.ambient-scene {
  --scene-x: 0px;
  --scene-y: 0px;
  --scene-scale: 1.08;
  --scene-blur: 0px;
  position: fixed;
  inset: -6%;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: #060d0b;
  contain: strict;
}

.ambient-scene__picture,
.ambient-scene__picture img,
.ambient-scene__chroma,
.ambient-scene__veil {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.ambient-scene__picture {
  transform:
    translate3d(var(--scene-x), var(--scene-y), 0)
    scale(var(--scene-scale));
  filter: blur(var(--scene-blur)) saturate(.88);
  will-change: transform, filter, opacity;
  transition:
    filter 420ms cubic-bezier(.22, 1, .36, 1),
    transform 420ms cubic-bezier(.22, 1, .36, 1),
    opacity 700ms cubic-bezier(.22, 1, .36, 1);
}

.ambient-scene__picture img {
  object-fit: cover;
}

.ambient-scene__chroma {
  background:
    radial-gradient(circle at 18% 14%, rgba(232, 200, 122, .05), transparent 34%),
    radial-gradient(circle at 78% 70%, rgba(95, 185, 138, .04), transparent 38%);
  mix-blend-mode: screen;
}

.ambient-scene__veil {
  background:
    linear-gradient(180deg,
      rgba(4, 8, 7, .08) 0%,
      rgba(4, 8, 7, .24) 48%,
      rgba(4, 8, 7, .48) 100%);
}

@media (prefers-reduced-motion: reduce) {
  .ambient-scene__picture {
    transform: scale(1.04);
    filter: none;
    transition: opacity 160ms linear;
  }
}

@media (prefers-contrast: more) {
  .ambient-scene__veil {
    background: rgba(4, 8, 7, .68);
  }
}
```

## Scroll driver

Update motion only inside a passive scroll handler scheduled through
`requestAnimationFrame`. Do not run an idle animation loop.

```ts
const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
const progress = Math.min(1, Math.max(0, scrollY / maxScroll));
const y = -12 + progress * 24;
const blur = progress * 4;

scene.style.setProperty('--scene-y', `${y}px`);
scene.style.setProperty('--scene-blur', `${blur}px`);
```

Pointer parallax is optional on pointer-capable devices and must stay within
±6 px. Do not request DeviceMotion or DeviceOrientation permission. Touch
devices already receive depth through scroll and focus transitions.

## Glass and content relationship

- Keep standard rows transparent; use hairline separators rather than cards.
- Use frosted panels only for the top veil, bottom rail, sheets, Collecta and
  editing surfaces.
- The background may be visible through glass but must not reduce text contrast.
- Place an additional local dark scrim behind charts, money totals and dense
  tables.
- Champagne belongs to selected states and decisive calls to action; it is not
  a general background tint.
- Coral remains reserved for blockers, urgent review and destructive actions.

## Performance

- Serve WebP first and retain PNG as the lossless source.
- Preload only the active route-family WebP.
- Decode the next likely family after the initial interactive state.
- Keep one outgoing and one incoming bitmap mounted only during route
  crossfades.
- Never stack all four masters or animate large CSS box shadows.
- Use `transform` for movement and keep the overscan layer fixed.
- On low-memory or data-saver devices, use the static WebP with no blur.

## Acceptance checks

- Text remains readable at every scroll position.
- No visible edge appears at maximum parallax.
- Route transitions do not flash the page background.
- Opening Collecta or a sheet visibly moves the wallpaper behind the glass.
- Reduced-motion mode has no scale or parallax movement.
- The backgrounds never imply hospitality; Spaces include boats, land, rooms,
  studios, venues, berths and future physical asset types.
