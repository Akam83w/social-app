CREATE TABLE IF NOT EXISTS "social_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "provider" varchar(20) NOT NULL,
  "provider_user_id" varchar(255) NOT NULL,
  "provider_email" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_identities_user_id_users_id_fk') THEN
    ALTER TABLE "social_identities" ADD CONSTRAINT "social_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_identities_provider_check') THEN
    ALTER TABLE "social_identities" ADD CONSTRAINT "social_identities_provider_check" CHECK ("provider" IN ('facebook','twitter'));
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "social_identities_provider_user_unique" ON "social_identities" USING btree ("provider","provider_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "social_identities_user_provider_unique" ON "social_identities" USING btree ("user_id","provider");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_identities_user_id_idx" ON "social_identities" USING btree ("user_id");
