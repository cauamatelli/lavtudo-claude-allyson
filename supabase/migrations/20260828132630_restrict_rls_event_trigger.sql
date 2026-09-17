-- Event-trigger helpers are infrastructure functions and must never be callable
-- through the public PostgREST API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
