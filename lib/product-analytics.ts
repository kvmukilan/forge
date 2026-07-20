import 'server-only'

import { getDb } from '@/lib/db'
import { productEvents } from '@/lib/db/schema'
import { uuid } from '@/lib/utils'

export type ProductEventName =
  | 'onboarding_completed'
  | 'assessment_retaken'
  | 'quest_completed'
  | 'adaptation_accepted'
  | 'adaptation_kept'

export async function recordProductEvent(
  userId: string,
  name: ProductEventName,
  properties: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  const db = await getDb()
  await db.insert(productEvents).values({ id: uuid(), userId, name, properties })
}
