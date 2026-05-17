import cron from 'node-cron';
import { runBackup } from './backup';
import fs from 'fs/promises';
import path from 'path';
import { DateTime } from 'luxon';
import { v4 as uuid } from 'uuid';

let isSchedulerInitialized = false;

export function initializeScheduler() {
  if (isSchedulerInitialized) {
    console.log('Scheduler already initialized.');
    return;
  }

  console.log('Initializing scheduler...');

  // Schedule backup to run daily at 2:00 AM server time
  // Format: second minute hour day-of-month month day-of-week
  // '0 2 * * *' means at minute 0 of hour 2 (2:00 AM) every day
  const backupJob = cron.schedule('0 2 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled daily backup task...`);
    try {
      await runBackup();
      console.log(`[${new Date().toISOString()}] Scheduled backup task completed successfully.`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Scheduled backup task failed:`, err);
    }
  }, {
    scheduled: true,
    // Consider adding timezone support later if needed, based on user settings
    // timezone: "Your/Timezone"
  });

  // Overdue task penalty — runs at midnight
  const overdueJob = cron.schedule('0 0 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running overdue task penalty...`);
    try {
      const dataDir = path.join(process.cwd(), 'data');
      const habitsPath = path.join(dataDir, 'habits.json');
      const coinsPath = path.join(dataDir, 'coins.json');

      const habitsRaw = await fs.readFile(habitsPath, 'utf-8').catch(() => '{"habits":[]}');
      const coinsRaw = await fs.readFile(coinsPath, 'utf-8').catch(() => '{"balance":0,"transactions":[]}');
      const habitsData = JSON.parse(habitsRaw);
      const coinsData = JSON.parse(coinsRaw);

      // Find overdue uncompleted tasks (use UTC midnight as approximation)
      const today = DateTime.now().startOf('day');
      const PENALTY = 5;

      type RawHabit = { id: string; name: string; isTask?: boolean; archived?: boolean; frequency: string; targetCompletions?: number; completions: string[] };

      const overdueTasks = (habitsData.habits as RawHabit[]).filter((h) => {
        if (!h.isTask || h.archived) return false;
        const dueDate = DateTime.fromISO(h.frequency).startOf('day');
        if (dueDate >= today) return false;
        const target = h.targetCompletions ?? 1;
        const completedOnDueDate = (h.completions || []).filter((c: string) => {
          return DateTime.fromISO(c).startOf('day').toISO() === dueDate.toISO();
        }).length;
        return completedOnDueDate < target;
      });

      if (overdueTasks.length > 0) {
        const penaltyTxs = overdueTasks.map((h) => ({
          id: uuid(),
          amount: -PENALTY,
          type: 'TASK_OVERDUE_PENALTY',
          description: `Overdue penalty: ${h.name}`,
          timestamp: new Date().toISOString(),
          relatedItemId: h.id,
        }));
        coinsData.transactions = [...penaltyTxs, ...coinsData.transactions];
        await fs.writeFile(coinsPath, JSON.stringify(coinsData, null, 2), 'utf-8');
        console.log(`Applied overdue penalty to ${overdueTasks.length} tasks`);
      }
    } catch (err) {
      console.error('Overdue penalty job failed:', err);
    }
  }, {
    scheduled: true,
  });

  console.log('Scheduler initialized. Daily backup scheduled for 2:00 AM server time.');
  isSchedulerInitialized = true;

  // Graceful shutdown handling (optional but recommended)
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received. Stopping scheduler...');
    backupJob.stop();
    overdueJob.stop();
    // Add cleanup for other jobs if needed
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received. Stopping scheduler...');
    backupJob.stop();
    overdueJob.stop();
    // Add cleanup for other jobs if needed
    process.exit(0);
  });
}
