-- Administrative RPCs run as service_role through the TanStack server routes.
-- The functions are SECURITY INVOKER, so the role also needs access to their
-- private helper functions; browser roles retain only the tracking helpers.
grant usage on schema private to service_role;
grant execute on function private.lavtudo_admin_ok(text, text) to service_role;
grant execute on function private.lavtudo_request_header(text) to service_role;
grant execute on function private.lavtudo_status_label(text) to service_role;
grant execute on function private.lavtudo_wash_json(bigint) to service_role;
grant execute on function private.lavtudo_machine_json(text) to service_role;
