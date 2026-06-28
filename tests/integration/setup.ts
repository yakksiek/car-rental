// core
import dotenv from "dotenv";

// Loaded via the integration project's `setupFiles` before any test runs.
// Pulls local-Supabase credentials from `.env.test` into `process.env` and
// fails fast with an actionable message if the machine is misconfigured —
// otherwise a missing key surfaces as an opaque fetch/connection error deep
// inside a test.
dotenv.config({ path: ".env.test" });

const REQUIRED = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Integration tests are missing required env var(s): ${missing.join(", ")}.\n` +
      `Copy .env.test.example to .env.test and fill in the values from \`npx supabase status\`\n` +
      `(SUPABASE_ANON_KEY = Publishable key, SUPABASE_SERVICE_ROLE_KEY = Secret key).`,
  );
}
