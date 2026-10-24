CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."base_unit" AS ENUM('g', 'ml');--> statement-breakpoint
CREATE TYPE "public"."goal_method" AS ENUM('manual', 'mifflin_st_jeor');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('female', 'male');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_time_order" CHECK ("appointments"."ends_at" > "appointments"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "client_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"energy_kcal" double precision NOT NULL,
	"protein_g" double precision NOT NULL,
	"carbs_g" double precision NOT NULL,
	"fat_g" double precision NOT NULL,
	"method" "goal_method" NOT NULL,
	"activity_factor" double precision,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_goals_date_order" CHECK ("client_goals"."valid_to" is null or "client_goals"."valid_to" >= "client_goals"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"birth_date" date,
	"sex" "sex",
	"email" text,
	"phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"base_unit" "base_unit" NOT NULL,
	"energy_kcal" double precision NOT NULL,
	"protein_g" double precision NOT NULL,
	"carbs_g" double precision NOT NULL,
	"fat_g" double precision NOT NULL,
	"portion_label" text,
	"portion_amount" double precision,
	"source" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "foods_nutrients_non_negative" CHECK ("foods"."energy_kcal" >= 0 and "foods"."protein_g" >= 0 and "foods"."carbs_g" >= 0 and "foods"."fat_g" >= 0),
	CONSTRAINT "foods_portion_pair" CHECK (("foods"."portion_label" is null) = ("foods"."portion_amount" is null))
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "meal_plans_date_order" CHECK ("meal_plans"."end_date" is null or "meal_plans"."end_date" >= "meal_plans"."start_date")
);
--> statement-breakpoint
CREATE TABLE "meal_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"measured_on" date NOT NULL,
	"weight_kg" double precision,
	"height_cm" double precision,
	"waist_cm" double precision,
	"hip_cm" double precision,
	"body_fat_pct" double precision,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_meal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_meal_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"quantity" double precision NOT NULL,
	"sort_order" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_meal_items_quantity_positive" CHECK ("plan_meal_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "plan_meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_plan_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"meal_type_id" uuid NOT NULL,
	"time" time,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_meals_day_number_positive" CHECK ("plan_meals"."day_number" >= 1)
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_goals" ADD CONSTRAINT "client_goals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_meal_items" ADD CONSTRAINT "plan_meal_items_plan_meal_id_plan_meals_id_fk" FOREIGN KEY ("plan_meal_id") REFERENCES "public"."plan_meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_meal_items" ADD CONSTRAINT "plan_meal_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_meals" ADD CONSTRAINT "plan_meals_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_meals" ADD CONSTRAINT "plan_meals_meal_type_id_meal_types_id_fk" FOREIGN KEY ("meal_type_id") REFERENCES "public"."meal_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_starts_at_idx" ON "appointments" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "appointments_client_id_idx" ON "appointments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_goals_client_id_idx" ON "client_goals" USING btree ("client_id","valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "client_goals_one_open_per_client" ON "client_goals" USING btree ("client_id") WHERE "client_goals"."valid_to" is null;--> statement-breakpoint
CREATE INDEX "meal_plans_client_id_idx" ON "meal_plans" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "measurements_client_id_idx" ON "measurements" USING btree ("client_id","measured_on");--> statement-breakpoint
CREATE INDEX "plan_meal_items_plan_meal_id_idx" ON "plan_meal_items" USING btree ("plan_meal_id");--> statement-breakpoint
CREATE INDEX "plan_meal_items_food_id_idx" ON "plan_meal_items" USING btree ("food_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_meals_plan_day_type_unique" ON "plan_meals" USING btree ("meal_plan_id","day_number","meal_type_id");--> statement-breakpoint
CREATE INDEX "plan_meals_meal_type_id_idx" ON "plan_meals" USING btree ("meal_type_id");