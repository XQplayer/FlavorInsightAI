# Staging to production read-only comparison

Production project URL observed in GitHub Actions variables: `https://nwcoyhavzbygyqeadcnw.supabase.co`, distinct from the verified Staging ref `zwbzyrshzegwlgcaxudo`. The Staging Management API verified five migrations. No production-scoped read credential was available, so production schema, migration versions, table RLS, Storage policies, profiles, task ownership and JWT behavior remain **not inspected**. A service-role success would not prove ordinary-user isolation.

| Surface | Staging evidence | Production evidence | Gate |
| --- | --- | --- | --- |
| Task/profile RLS | Real JWT probe 26/26 and deployed metadata in prior report | No production metadata/JWT probe | Private Agent task access closed |
| Storage | Private buckets and owner/admin policies in prior report | Unknown | Private result download closed |
| AI conversations | Gateway memory-only ownership checks | Production persistence/config unknown | Cross-restart service not ready |
| PCA tasks | Browser-local data and loopback R broker | No hosted authenticated R broker | Online PCA closed |
| AI API | Local Responses API verified; Render Python service configured | Public Render `/health` and `/ai/session` timed out in this check | Live chat readiness unknown |

Required next read-only audit: obtain a production-scoped *read-only* Management credential, verify exact project identity, compare `pg_policies`, table RLS flags, bucket policies and migration history, then run two ordinary **approved production test accounts only after separate test-account approval**. No production database write was made here. The local retention-cron migration embeds another project URL and must not be applied without redesign and review.
