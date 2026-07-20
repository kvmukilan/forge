ALTER TABLE "coin_transactions" ADD COLUMN "event_key" text;--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD COLUMN "event_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "coin_tx_event_idx" ON "coin_transactions" USING btree ("user_id","event_key");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_tx_event_idx" ON "xp_transactions" USING btree ("user_id","event_key");