# Competitive release audit

Reviewed 2026-07-16 against current first-party product documentation.

## What the category already does well

| Product | Product strength | Release implication for Forge |
|---|---|---|
| [Habitica](https://habitica.com/static/features) | Deep RPG rewards, equipment, quests, parties, and community challenges | Forge already competes here through XP, coins, bosses, pets, guilds, leagues, skills, and seasons. Another game layer would add surface area without fixing the daily experience. |
| [Fabulous](https://help.thefabulous.co/en/support/solutions/articles/101000427430-how-does-fabulous-work-) | Guided morning/afternoon/evening routines and multi-week journeys | Users benefit from being told what to do now, not only from having a complete habit database. Forge needed a clearer bridge between intent and action. |
| [Finch](https://help.finchcare.com/hc/en-us/articles/37935669335309-Our-Approach-to-Self-Care) | Gentle onboarding, small steps, personal goals, and non-judgmental self-care | Forge's failure-oriented streak pressure needed a humane counterweight for low-capacity days. |
| [Habitify](https://feedback.habitify.me/changelog/habitify-android-3200-a-smoother-smarter-experience-on-android) | Encourages a smaller effort before skipping and captures context for skips/failures | A recovery path and reflection are more valuable before release than another punishment or currency. |

## Highest-impact gap

Forge had strong tracking and exceptional metagame depth, but the dashboard presented nearly every system before the user's actual work. It answered "how am I progressing?" many times and "what should I do now?" only near the bottom.

The release improvement is **Daily Forge**, an adaptive command center that:

1. Asks for today's realistic capacity: low, steady, or high.
2. Suggests a 1, 3, or 5-item plan using keystones and real task priority before coin value.
3. Treats low-energy days as a minimum viable day with one meaningful win.
4. Runs completion and undo through the existing coins, XP, boss, streak, and achievement pipeline.
5. Offers an optional mood and short reflection once the plan is complete.

This combines the strongest behavioral patterns observed in the category while preserving Forge's differentiated game systems.

## Design decision

The home screen now has two explicit layers:

- **Today:** greeting, risk alert, Daily Forge, and the actionable due list.
- **Your world:** character, quests, coins, boss, party, pet, season, streak history, and pattern insight.

The new surface follows the existing dark Kinetic Minimalism system: ember accent, restrained glow, large type, soft high-radius surfaces, and lucide-only controls. The visual hierarchy intentionally spends the strongest contrast on the next action.

## Release acceptance

- Plans persist per user/day and are isolated by authenticated ownership.
- Server input is validated, deduplicated, and capped to the selected energy level.
- The migration is additive and deletes plans automatically with the account.
- Completion, undo, multi-count progress, low-energy recovery, and reflection have documented smoke tests in [play-release.md](play-release.md).
- Typecheck, lint, tests, and the optimized production build are required release gates.
