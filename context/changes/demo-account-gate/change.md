---
change_id: demo-account-gate
title: Demo admin account for recruiters, with POST /api/staff gated on demo
status: implementing
created: 2026-08-28
updated: 2026-08-28
archived_at: null
---

## Notes

add a demo admin account for portfolio recruiters: `is_demo` boolean on profiles surfaced through middleware onto App.Locals, a demo guard on POST /api/staff (the only arbitrary-recipient invite path), demo credentials + "Wypełnij dane demo" prefill on /auth/signin, and a deferrable trailing phase for a nightly demo-data reset
