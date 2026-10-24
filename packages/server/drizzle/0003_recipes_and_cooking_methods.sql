CREATE TYPE "public"."cooking_method" AS ENUM('raw', 'boiled', 'steamed', 'grilled', 'baked', 'sauteed', 'stewed', 'fried');--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"quantity" double precision NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_ingredients_quantity_positive" CHECK ("recipe_ingredients"."quantity" > 0),
	CONSTRAINT "recipe_ingredients_not_self" CHECK ("recipe_ingredients"."recipe_id" <> "recipe_ingredients"."food_id")
);
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "cooking_method" "cooking_method";--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "recipe_yield_g" double precision;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_foods_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_food_id_idx" ON "recipe_ingredients" USING btree ("food_id");--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_recipe_yield_positive" CHECK ("foods"."recipe_yield_g" is null or ("foods"."recipe_yield_g" > 0 and "foods"."base_unit" = 'g'));