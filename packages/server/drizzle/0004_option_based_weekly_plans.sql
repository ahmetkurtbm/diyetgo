CREATE TYPE "public"."meal_plan_kind" AS ENUM('daily', 'options');--> statement-breakpoint
ALTER TABLE "meal_plans" ADD COLUMN "kind" "meal_plan_kind" DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD COLUMN "weekly_quotas" jsonb DEFAULT '[]'::jsonb NOT NULL;