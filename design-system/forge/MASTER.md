# Forge UI System

> The UI/UX Pro Max generator was used as a starting point, then corrected for the actual product. Its habit-tracker product results, touch rules, dark sleep-tracker palette, subtle-motion dial, and Next.js guidance are adopted. Its newsletter layout, serif typography, and light amber palette are intentionally rejected because they conflict with Forge's application shell and established identity.

## Product intent

Forge is a mobile-first habit and self-progression companion. It should feel calm enough to open every morning, focused enough to finish in under a minute, and rewarding without becoming a noisy game dashboard.

Design principles:

1. Today first: the current plan and next action outrank every secondary system.
2. One primary action per screen; progression is evidence, not clutter.
3. Mobile is the default. Desktop adds breathing room and context, not extra navigation.
4. Earned color: violet identifies action/progression, cyan identifies insight, amber identifies currency or streaks, green identifies success.
5. Original identity: learn from Bevel's metric hierarchy and Mobbin's mobile patterns without copying layouts, assets, language, or branding.

## Foundations

### Color

Keep the existing semantic HSL tokens and tune the surfaces rather than hardcoding colors in components.

| Role | Intent |
|---|---|
| Background | Deep blue-black, never pure black |
| Surface | Slightly raised navy with a clear border |
| Primary | Accessible violet for selected and primary actions |
| Insight | Cyan for recommendations and explanatory data |
| Success | Green plus icon/text; never color alone |
| Reward | Amber only for coins, streaks, and rare rewards |
| Destructive | Red with an explicit label |

All normal text must meet 4.5:1 contrast and secondary text 3:1. Blur is reserved for navigation and modal separation, not decorative cards.

### Typography

Use the existing Geist variable font. It is compact, readable, already loaded through Next.js, and avoids another font request. Use sentence case, not broad uppercase blocks.

- Display: 28-36px, 700-800, tight tracking.
- Page title: 24-30px, 700.
- Section title: 17-20px, 650-700.
- Body: 15-16px, 1.5 line height.
- Supporting text: 13-14px, 1.45 line height.
- Labels: 12px minimum; uppercase only for short metadata.
- Numbers: tabular figures.

### Shape and elevation

- App surfaces: 20-24px radius on mobile feature cards, 16-20px on compact cards.
- Controls: 12-16px radius; primary buttons may be pill-shaped.
- One border and one restrained ambient shadow scale.
- No card should lift or change layout bounds on hover/press.

### Spacing

Use a 4/8px rhythm: 4, 8, 12, 16, 24, 32, 48. Phone gutters are 16px; tablet 24px; desktop 32px. Keep at least 8px between adjacent touch targets.

## Interaction

- Touch targets are at least 44x44px.
- Use buttons for actions and Next.js Links for destinations.
- Press feedback arrives within 100ms through color, opacity, or a stable inset state.
- Transitions use opacity/transform, 150-250ms, and the existing reduced-motion override.
- Async actions disable themselves and show progress.
- Completion always returns a clear success state and preserves undo.
- Browser back, deep links, and scroll restoration remain native.

## Responsive shell

- Phone: top utility bar, four primary bottom tabs plus More, safe-area padding, one vertical scroll region.
- Tablet: same hierarchy with wider content and optional two-column detail.
- Desktop: compact grouped sidebar with only five top-level destinations visible; secondary features live behind a single expandable Library section. Header remains utility-only.
- Content maximum is 1120px for application screens and 720px for focused reading/forms.
- Provide a skip link and a focusable `main` region.

## Navigation hierarchy

Primary destinations:

1. Today (`/`)
2. Quests (`/habits`)
3. Character (`/character`)
4. Journey (`/journey`)
5. More/Library (secondary destinations)

Rewards appears contextually from Character/Journey and inside Library rather than competing with daily action. Tasks are managed within Quests/Library until the product later unifies their data model.

## Core component patterns

- Daily status strip: three compact signals (capacity, progress, streak/reward), not three competing hero cards.
- Mission card: intention, date/capacity, 1-3 quest rows, compact progress, one subordinate adjust action.
- Quest row: 48px minimum, large completion control, title, one line of useful metadata, reward at the trailing edge.
- Insight card: short headline, one recommendation, optional secondary action.
- Bottom sheet/drawer: 50-60% scrim, visible close control, grouped labeled destinations, safe-area inset.
- Empty state: explanation plus one clear next action.

## Quality gates

- Test 375, 390, 768, 1024, and 1440px; include mobile landscape.
- No horizontal overflow or content hidden by fixed bars.
- Bottom navigation never exceeds five labeled items.
- All icons use Lucide with consistent stroke and sizing.
- Sequential headings, visible focus, descriptive control names, color-independent states.
- Reduced motion, 200% text zoom, keyboard-only navigation, and dark contrast are verified.

