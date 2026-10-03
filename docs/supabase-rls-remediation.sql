-- Review and apply only after confirming the API is the sole data access layer.
-- The API connects with privileged database credentials, so enabling RLS on these
-- tables will protect the public Data API without blocking the server-side API.
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Do not grant anon/authenticated access unless the frontend needs direct Data API access.
-- The current web/mobile clients use the SDM API, so leaving these tables without
-- public policies intentionally denies direct PostgREST access.
