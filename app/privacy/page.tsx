export const metadata = {
  title: 'Privacy Policy — Forge',
}

const SECTIONS = [
  {
    title: 'What we collect',
    body: `Forge stores the data you create in the app: your account (username, and email if you sign in with Google), your habits and tasks, completion history, rewards, and gamification progress (XP, coins, streaks, pets, guilds, leagues). If you enable reminders, we store a push-notification subscription for your device. If you upload an avatar, we store that image.`,
  },
  {
    title: 'How we use it',
    body: `Your data is used solely to run the app for you: showing your progress, computing streaks and leaderboards, and sending the reminders you asked for. We do not sell your data, we do not share it with third parties for advertising, and we run no third-party analytics or ad SDKs.`,
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
    body: `You can delete individual habits, transactions, and data from within the app at any time. Deleting your account from Settings permanently removes your account and all associated data (habits, completions, coins, XP, pets, guild membership, league history, push subscriptions, and avatars). This is immediate and irreversible.`,
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
