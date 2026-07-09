import { init } from '@/lib/env.server'; // startup env var check

export async function register() {
  // We only want to run this code on the server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    init();
  }
}
