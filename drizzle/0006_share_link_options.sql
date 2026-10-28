ALTER TABLE "share_links" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "allow_download" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "download_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "last_viewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "locked_until" timestamp;