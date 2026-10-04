CREATE TYPE "public"."share_link_kind" AS ENUM('folder', 'files');--> statement-breakpoint
CREATE TABLE "share_link_files" (
	"link_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	CONSTRAINT "share_link_files_link_id_file_id_pk" PRIMARY KEY("link_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"kind" "share_link_kind" NOT NULL,
	"folder_id" uuid NOT NULL,
	"expires_at" timestamp,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "share_link_files" ADD CONSTRAINT "share_link_files_link_id_share_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link_files" ADD CONSTRAINT "share_link_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "share_link_files_file_idx" ON "share_link_files" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "share_links_folder_idx" ON "share_links" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "share_links_expires_idx" ON "share_links" USING btree ("expires_at");