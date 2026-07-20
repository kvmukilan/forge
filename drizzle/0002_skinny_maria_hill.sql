CREATE TABLE "attribute_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"attribute" text NOT NULL,
	"amount" integer NOT NULL,
	"source" text NOT NULL,
	"event_key" text NOT NULL,
	"related_habit_id" text,
	"completion_at" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progression_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"assessment_version" integer DEFAULT 1 NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"base_attributes" jsonb DEFAULT '{"strength":3,"vitality":3,"focus":3,"wisdom":3,"discipline":3,"connection":3}'::jsonb NOT NULL,
	"explanations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preferred_pace" text DEFAULT 'balanced' NOT NULL,
	"weekday_minutes" integer DEFAULT 30 NOT NULL,
	"weekend_minutes" integer DEFAULT 45 NOT NULL,
	"preferred_time" text DEFAULT 'flexible' NOT NULL,
	"rest_days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"adaptation_enabled" boolean DEFAULT true NOT NULL,
	"campaign_started_on" date,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quest_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"habit_id" text NOT NULL,
	"completion_at" text NOT NULL,
	"rating" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "primary_attribute" text;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "secondary_attribute" text;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "attribute_reward" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "progression_origin" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "adaptive_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "adaptation_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "last_adapted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "paused_until" date;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "estimated_minutes" integer;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "recommendation_reason" text;--> statement-breakpoint
ALTER TABLE "attribute_transactions" ADD CONSTRAINT "attribute_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_transactions" ADD CONSTRAINT "attribute_transactions_related_habit_id_habits_id_fk" FOREIGN KEY ("related_habit_id") REFERENCES "public"."habits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_profiles" ADD CONSTRAINT "progression_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_feedback" ADD CONSTRAINT "quest_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_feedback" ADD CONSTRAINT "quest_feedback_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_tx_event_idx" ON "attribute_transactions" USING btree ("user_id","event_key","attribute");--> statement-breakpoint
CREATE INDEX "attribute_tx_user_idx" ON "attribute_transactions" USING btree ("user_id","attribute","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quest_feedback_completion_idx" ON "quest_feedback" USING btree ("user_id","habit_id","completion_at");--> statement-breakpoint
CREATE INDEX "quest_feedback_user_idx" ON "quest_feedback" USING btree ("user_id","created_at");