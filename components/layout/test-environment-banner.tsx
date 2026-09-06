import { getAppEnv } from "@/lib/app-env";

export function TestEnvironmentBanner() {
  if (getAppEnv() !== "staging") return null;

  return (
    <div className="bg-amber-400 px-3 py-1.5 text-center text-xs font-semibold text-amber-950">
      TEST ENVIRONMENT — dummy data only. Live gym stays at ojas-chi.vercel.app
    </div>
  );
}
