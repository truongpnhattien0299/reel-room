ALTER TABLE "files" ADD COLUMN "sha256" text;--> statement-breakpoint
CREATE INDEX "files_size_idx" ON "files" USING btree ("size");--> statement-breakpoint
CREATE INDEX "files_sha256_idx" ON "files" USING btree ("sha256");