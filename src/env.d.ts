declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    // null means unauthenticated *or* authenticated-but-no-profile (fail-closed).
    role: import("./types").AppRole | null;
  }
}
