/** Login IDs are lowercase letters/digits only (e.g. saikaran, not "Sai Karan"). */

export const USERNAME_PATTERN = /^[a-z0-9]{2,32}$/;

const NAME_MAP: Record<string, string> = {
  lokesh: "lokesh",
  "sai karan": "saikaran",
  saikaran: "saikaran",
  rohith: "rohit",
  rohit: "rohit",
  rahul: "rahul",
  yashoda: "yashoda",
  rama: "rama",
};

const EMAIL_LOCAL_MAP: Record<string, string> = {
  owner: "owner",
  supervisor: "lokesh",
  lokesh: "lokesh",
  sai: "saikaran",
  saikaran: "saikaran",
  rohith: "rohit",
  rohit: "rohit",
  rahul: "rahul",
};

export function slugifyUsername(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Accepts `lokesh`, `Lokesh`, or `owner@impackt.gym` / `supervisor@impackt.gym`. */
export function resolveLoginLookup(raw: string): { username: string; email?: string } {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return { username: "" };

  if (trimmed.includes("@")) {
    const local = trimmed.split("@")[0] ?? "";
    const username = EMAIL_LOCAL_MAP[local] || slugifyUsername(local);
    return { username, email: trimmed };
  }

  return { username: normalizeUsername(trimmed) };
}

export function emailForUsername(username: string): string {
  return `${username}@impackt.gym`;
}

export function suggestedStaffUsername(input: {
  name: string;
  email?: string | null;
  role?: string;
}): string {
  if (input.role === "OWNER") return "owner";

  const nameKey = input.name.trim().toLowerCase();
  if (NAME_MAP[nameKey]) return NAME_MAP[nameKey];

  const slug = slugifyUsername(input.name);
  if (NAME_MAP[slug]) return NAME_MAP[slug];

  const local = input.email?.split("@")[0]?.toLowerCase() ?? "";
  if (EMAIL_LOCAL_MAP[local]) return EMAIL_LOCAL_MAP[local];

  return slug || local.replace(/[^a-z0-9]/g, "") || "user";
}

export function uniqueUsername(base: string, used: Set<string>): string {
  const root = base && USERNAME_PATTERN.test(base) ? base : "user";
  if (!used.has(root)) return root;
  let n = 2;
  while (used.has(`${root}${n}`)) n += 1;
  return `${root}${n}`;
}
