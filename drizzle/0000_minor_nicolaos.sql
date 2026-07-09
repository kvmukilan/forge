CREATE TABLE "avatars" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mime_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bosses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"week_start" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"max_hp" integer NOT NULL,
	"current_hp" integer NOT NULL,
	"is_defeated" boolean DEFAULT false NOT NULL,
	"reward_claimed" boolean DEFAULT false NOT NULL,
	"reward_xp" integer NOT NULL,
	"reward_coins" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chest_openings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"reward" jsonb NOT NULL,
	"opened_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coin_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"type" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"timestamp" text NOT NULL,
	"related_item_id" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "completions" (
	"habit_id" text NOT NULL,
	"user_id" text NOT NULL,
	"completed_at" text NOT NULL,
	"note" text,
	CONSTRAINT "completions_habit_id_completed_at_pk" PRIMARY KEY("habit_id","completed_at")
);
--> statement-breakpoint
CREATE TABLE "daily_quests" (
	"user_id" text NOT NULL,
	"quest_date" date NOT NULL,
	"quest_key" text NOT NULL,
	"target" integer NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "daily_quests_user_id_quest_date_quest_key_pk" PRIMARY KEY("user_id","quest_date","quest_key")
);
--> statement-breakpoint
CREATE TABLE "guild_members" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_members_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "guild_quests" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"type" text NOT NULL,
	"difficulty" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"emoji" text NOT NULL,
	"target" integer NOT NULL,
	"week_start" text NOT NULL,
	"reward" jsonb NOT NULL,
	"claimed_by" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"description" text,
	"invite_code" text NOT NULL,
	"admin_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "guilds_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"frequency" text NOT NULL,
	"coin_reward" integer DEFAULT 1 NOT NULL,
	"target_completions" integer,
	"is_task" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"drawing" text,
	"difficulty" text,
	"project_id" text,
	"priority" text,
	"intention_when" text,
	"intention_where" text,
	"is_keystone" boolean DEFAULT false NOT NULL,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_cohorts" (
	"id" text PRIMARY KEY NOT NULL,
	"week_start" text NOT NULL,
	"tier" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_members" (
	"cohort_id" text NOT NULL,
	"user_id" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"result" text,
	CONSTRAINT "league_members_cohort_id_user_id_pk" PRIMARY KEY("cohort_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "login_claims" (
	"user_id" text NOT NULL,
	"claim_date" date NOT NULL,
	"streak_index" integer NOT NULL,
	"reward" jsonb NOT NULL,
	CONSTRAINT "login_claims_user_id_claim_date_pk" PRIMARY KEY("user_id","claim_date")
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"user_id" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"form" text NOT NULL,
	"hp" integer NOT NULL,
	"max_hp" integer NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"xp_to_next_form" integer NOT NULL,
	"mood" text NOT NULL,
	"last_fed_at" text,
	"adopted_at" text NOT NULL,
	"last_daily_update" date
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '#FF4D00' NOT NULL,
	"emoji" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_log" (
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"sent_on" date NOT NULL,
	CONSTRAINT "push_log_user_id_kind_sent_on_pk" PRIMARY KEY("user_id","kind","sent_on")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text,
	"avatar_path" text,
	"permissions" jsonb,
	"is_admin" boolean DEFAULT false NOT NULL,
	"email" text,
	"oauth_provider" text,
	"oauth_id" text,
	"last_notification_read_timestamp" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"coin_cost" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"target_completions" integer,
	"link" text,
	"drawing" text
);
--> statement-breakpoint
CREATE TABLE "xp_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"gems" integer DEFAULT 0 NOT NULL,
	"shields" integer DEFAULT 0 NOT NULL,
	"shield_used_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"perfect_days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"milestone_rewards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_boosts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unlocked_achievements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_title" text,
	"equipped_titles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bosses_defeated" integer DEFAULT 0 NOT NULL,
	"skill_progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"unlocked_skills" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"source" text NOT NULL,
	"related_item_id" text,
	"timestamp" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bosses" ADD CONSTRAINT "bosses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chest_openings" ADD CONSTRAINT "chest_openings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_quests" ADD CONSTRAINT "daily_quests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_quests" ADD CONSTRAINT "guild_quests_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_cohort_id_league_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."league_cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_claims" ADD CONSTRAINT "login_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_log" ADD CONSTRAINT "push_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_state" ADD CONSTRAINT "xp_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bosses_user_week_idx" ON "bosses" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "coin_tx_user_idx" ON "coin_transactions" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX "completions_user_idx" ON "completions" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "guild_members_user_idx" ON "guild_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "guild_quests_guild_week_idx" ON "guild_quests" USING btree ("guild_id","week_start");--> statement-breakpoint
CREATE INDEX "habits_user_idx" ON "habits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "league_cohorts_week_idx" ON "league_cohorts" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "projects_user_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subs_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_oauth_idx" ON "users" USING btree ("oauth_provider","oauth_id");--> statement-breakpoint
CREATE INDEX "wishlist_user_idx" ON "wishlist_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "xp_tx_user_idx" ON "xp_transactions" USING btree ("user_id","timestamp");