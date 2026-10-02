ALTER TABLE "follows" ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","following_id");
--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("blocker_id","blocked_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_parent_comment_id_idx" ON "comments" USING btree ("parent_comment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_actor_id_idx" ON "notifications" USING btree ("actor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");
