CREATE TYPE "public"."activity_action" AS ENUM('file.upload', 'file.rename', 'file.move', 'file.trash', 'file.restore', 'file.purge', 'folder.create', 'folder.rename', 'folder.move', 'folder.trash', 'folder.restore', 'folder.purge', 'share.grant', 'share.revoke', 'link.create', 'link.update', 'link.revoke', 'user.invite', 'user.role', 'user.lock', 'user.unlock', 'user.password');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"action" "activity_action" NOT NULL,
	"folder_id" uuid,
	"folder_path" text,
	"target_user_id" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_created_idx" ON "activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_folder_path_idx" ON "activity" USING btree ("folder_path" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "activity_actor_idx" ON "activity" USING btree ("actor_id");