CREATE TABLE "daily_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_date" date NOT NULL,
	"energy" text DEFAULT 'steady' NOT NULL,
	"intention" text DEFAULT '' NOT NULL,
	"habit_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reflection" text DEFAULT '' NOT NULL,
	"mood" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_plans_user_date_idx" ON "daily_plans" USING btree ("user_id","plan_date");