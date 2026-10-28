CREATE TABLE "favorites" (
	"user_id" text NOT NULL,
	"file_id" uuid,
	"folder_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_one_target" CHECK (("favorites"."file_id" is null) <> ("favorites"."folder_id" is null))
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_file_uq" ON "favorites" USING btree ("user_id","file_id") WHERE "favorites"."file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_folder_uq" ON "favorites" USING btree ("user_id","folder_id") WHERE "favorites"."folder_id" is not null;