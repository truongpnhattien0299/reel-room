ALTER TABLE "files" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "folders" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_deleted_idx" ON "files" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "folders_deleted_idx" ON "folders" USING btree ("deleted_at");