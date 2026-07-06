/** Treat empty FormData strings as undefined before numeric coercion. */
export function emptyToUndefined(val: unknown): unknown {
  if (val === "" || val === null || val === undefined) return undefined;
  return val;
}
