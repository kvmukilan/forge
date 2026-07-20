export const metadata = {
  title: 'Privacy Policy — Forge',
}

const SECTIONS = [
  {
    title: 'What we collect',
    body: `Forge stores the data you create in the app: your account (username, and email if you sign in with Google), assessment answers, editable starting attributes, habits and tasks, completion feedback and history, rewards, and progression (XP, coins, streaks, pets, guilds, leagues). Optional constraints you enter during assessment remain private to your account. If you enable reminders, we store a push-notification subscription for your device. If you upload an avatar, we store that image.`,
  },
  {
    title: 'How we use it',
    body: `Your data is used solely to run and improve the app: generating your editable program, showing progress, computing streaks and leaderboards, and sending reminders you requested. Forge records limited first-party flow events such as onboarding completion and adaptation acceptance, but never includes assessment answers, habit names, or free text in those events. We do not sell your data, share it for advertising, or run third-party analytics or ad SDKs.`,
  },
  {
    title: 'Where it lives',
    body: `Data is stored in a managed Postgres database (Neon) and served through Vercel. Both process data on our behalf as infrastructure providers. All traffic is encrypted in transit (HTTPS).`,
  },
  {
    title: 'Social features',
    body: `If you join a guild or compete in a weekly league, your username, avatar, and activity counts (habit completions, scores) are visible to other members of that guild or league cohort. Your habit names and personal details are never shown to other users, except that recent completion descriptions appear in your guild's activity feed.`,
  },
  {
    title: 'Your controls',
    body: `You can edit or retake your assessment and edit, pause, freeze adaptation for, or permanently delete recommended quests. Deleting your account from Settings permanently removes your account and all associated data, including assessment, attributes, habits, completions, reward ledgers, first-party flow events, guild membership, push subscriptions, and avatars. This is immediate and irreversible.`,
  },
  {
    title: 'Notifications',
    body: `Push reminders are optional and off by default. You can turn them off in Settings at any time, which also deletes your push subscription from our servers.`,
  },
  {
    title: 'Children',
    body: `Forge is not directed at children under 13, and we do not knowingly collect data from them.`,
  },
  {
    title: 'Contact',
    body: `Questions or data requests: kvmukilan@gmail.com.`,
  },
]

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div>
        <h1 className="page-title">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Forge — last updated July 2026</p>
      </div>
      <div className="space-y-6">
        {SECTIONS.map(section => (
          <section key={section.title}>
            <h2 className="text-lg font-bold mb-1.5">{section.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
