ALTER TABLE "apikeys" ADD COLUMN "config_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
CREATE INDEX "apikeys_config_id_idx" ON "apikeys" USING btree ("config_id");