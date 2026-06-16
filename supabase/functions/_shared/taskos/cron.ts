// LuminaTaskOS — shared cron-auth for scheduled edge functions.
// The cron secret lives ONLY in the DB (taskos_internal_config): pg_cron sends it
// via pg_net, and we verify it here through the service-role client. Fail-closed.
// This is defense-in-depth — the real boundary is that every scheduled function
// reads user_id from trusted rows (telegram links / owned rows), never the body.

function ctEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// deno-lint-ignore no-explicit-any
export async function checkCronSecret(req: Request, svc: any): Promise<boolean> {
  const got = req.headers.get("x-taskos-cron") ?? "";
  if (!got) return false;
  const { data } = await svc.from("taskos_internal_config").select("value").eq("key", "cron_secret").maybeSingle();
  const expected = (data as any)?.value ?? "";
  if (!expected) return false;
  return ctEqual(got, expected);
}
