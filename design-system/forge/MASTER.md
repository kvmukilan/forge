# Forge UI System

> UI/UX Pro Max was used as a research tool, then corrected for the actual product. Forge follows its mobile touch, focus, reduced-motion, and minimalist hierarchy guidance while using an original visual system.

## Product intent

Forge is a mobile-first habit and self-progression companion. It should feel calm enough to open every morning, focused enough to finish in under a minute, and rewarding without becoming a noisy game dashboard.

Design principles:

1. Today first: the current plan and next action outrank every secondary system.
2. One primary action per screen; progression is evidence, not clutter.
3. Mobile is the default. Desktop adds breathing room and context, not extra navigation.
4. Earned color: warm white and graphite carry the interface; mint appears only for progress, confirmation, and the current action. Amber is reserved for currency and streaks.
5. Original identity: learn from Bevel's metric hierarchy and Mobbin's mobile patterns without copying layouts, assets, language, or branding.

## Foundations

### Color

Keep the existing semantic HSL tokens and tune the surfaces rather than hardcoding colors in components.

| Role | Intent |
|---|---|
| Background | Deep graphite, never pure black |
| Surface | Neutral graphite with a quiet border |
| Primary | Accessible mint for selected and primary actions |
| Insight | Sky blue for recommendations and explanatory data |
| Success | Green plus icon/text; never color alone |
| Reward | Amber only for coins, streaks, and rare rewards |
| Destructive | Red with an explicit label |

All normal text must meet 4.5:1 contrast and secondary text 3:1. Avoid decorative gradients, colored glows, and tinted shadows. Blur is reserved for modal separation.

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

- App surfaces: 12-16px radius. Reserve circles for icons, avatars, and progress indicators.
- Controls: 8-12px radius; primary buttons are compact rectangles rather than pills.
- One quiet border scale. Shadows are reserved for overlays.
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
- Desktop: compact grouped sidebar with four top-level destinations visible; secondary features, including Rewards, live behind a single expandable Library section. Header remains utility-only.
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

## Onboarding

- Onboarding is an immersive setup flow with no app header, desktop sidebar, or mobile bottom bar.
- Use one centered solid surface, plain progress, and one primary action per step.
- Selected options use a border, check, and restrained mint state; never a purple wash or glow.
- Questions explain that starting attributes are editable self-reports, not diagnoses.

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
