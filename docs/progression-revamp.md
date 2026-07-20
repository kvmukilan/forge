# Forge progression revamp

## Product position

Forge is a practical daily-planning app with the emotional cadence of a progression RPG. It should make the next useful action obvious, make growth visible, and let the player recover from an imperfect day without erasing prior effort.

The product borrows no names, art, story, interface, or other protected expression from *Solo Leveling* or Life Reset. The inspiration is limited to broad game mechanics: an initial assessment, visible attributes, quests, ranks, unlocks, and escalating challenges.

Research references:

- Life Reset App Store listing and reviews: https://apps.apple.com/us/app/life-reset-66-day-habit/id6478942469
- Habitica product loop: https://habitica.com/static/home?lang=en
- Self-Determination Theory: https://selfdeterminationtheory.org/about-the-theory/
- The variability behind the "66 days" finding: https://www.surrey.ac.uk/news/does-it-really-take-66-days-form-habit-we-asked-expert-dr-pippa-lally

## Core loop

1. A versioned self-assessment estimates six editable starting attributes.
2. Forge explains each estimate and proposes a small personal program.
3. The player edits, replaces, or removes any proposal before activation.
4. Daily Forge selects a capacity-aware subset for today.
5. Completion awards existing XP and coins plus auditable attribute XP.
6. Weekly adaptation recommends a one-step increase, hold, or recovery step.
7. Overall level, attribute levels, campaign chapters, ranks, skill trees, bosses, rewards, and companion growth make progress visible.

## Attributes

| Attribute | Measures practiced behavior in |
| --- | --- |
| Strength | movement and physical training |
| Vitality | sleep, nutrition, recovery, and health maintenance |
| Focus | attention, planning, and distraction management |
| Wisdom | learning, reflection, and deliberate practice |
| Discipline | consistency, follow-through, and keeping commitments small |
| Connection | relationships, contribution, and community |

Starting values are self-reported estimates on a 1-10 scale, never diagnoses. Every score includes a short explanation and can be corrected before confirmation.

## Adaptation policy

- Require at least five eligible opportunities before increasing difficulty.
- Increase only when rolling adherence is at least 80% and feedback is not predominantly "too hard".
- Hold between 50% and 79%, or when evidence is insufficient.
- Recommend a smaller version below 50%, after repeated skips, or after "too hard" feedback.
- Change at most one step per review and never adapt every habit at once.
- Respect rest days, current daily energy, paused habits, and an explicit adaptation opt-out.
- Treat feedback as a recommendation input; the player always accepts or rejects the change.

The desired result is competence without coercion: useful challenge, clear recovery, and user control.

## Data design

- `progression_profiles`: assessment version, responses, editable base attributes, explanations, pace, capacity, rest days, campaign start, and adaptation preference.
- additive habit fields: primary/secondary attribute, attribute reward, origin, adaptation setting/level, and optional pause date.
- `attribute_transactions`: append-only, user-scoped attribute XP with a unique event key for idempotency and auditability.
- `quest_feedback`: one effort rating per user, habit, and completion event.
- existing `daily_plans`: the ordered, capacity-aware plan for a user and date.

Existing rows remain valid through nullable/defaulted fields. Existing habits receive a category-based attribute mapping when read and can be edited later.

## Experience architecture

- **Today:** Daily Forge, why each mission matters, completion criteria, rewards, and next unlock.
- **Character:** overall level, rank, six attributes, titles, and current campaign chapter.
- **Journey:** 66-day campaign structure, bosses, skills, achievements, seasons, and recovery history. Sixty-six days is a campaign frame, not a habit-formation promise.
- **Rewards:** coins, wishlist, chests, companion, and cosmetics.
- **More:** full habit/task management, calendar, statistics, guild, league, projects, and settings.

The current release will prioritize the assessment-to-program-to-daily-plan-to-visible-attributes path and reorganize existing surfaces without deleting established features.

## Reliability boundaries

- Ownership checks stay server-side for every read and write.
- Database migrations are additive and forward-only.
- Attribute rewards use unique completion-derived event keys.
- Completion, undo, timezones, repeated requests, and assessment retakes receive automated coverage.
- Sensitive free-text assessment answers are stored only in the user's profile and are not emitted as analytics properties.
- Core behavior has no AI dependency; generation and adaptation are deterministic and explainable.

## Release gates

Type checking, automated tests, the production build, additive Neon migrations, mobile/desktop smoke tests, credentials auth, Google OAuth initiation/callback registration, persistence after refresh, runtime logs, and cron authorization must all be verified on preview before production promotion.
