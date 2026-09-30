CREATE INDEX "posts_user_created_at_idx" ON "posts" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "comments_post_created_at_idx" ON "comments" USING btree ("post_id","created_at");
--> statement-breakpoint
CREATE INDEX "follows_following_status_idx" ON "follows" USING btree ("following_id","status");
