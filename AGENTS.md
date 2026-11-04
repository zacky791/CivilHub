# CivilHub workspace rules

Use only the `supabase_civilhub` MCP connection for all Supabase operations in this workspace. This is mandatory, not merely a default.

Do not use `supabase_evantage` or any other Supabase connection for CivilHub. If `supabase_civilhub` is unavailable, report the connection issue rather than falling back to another project.
