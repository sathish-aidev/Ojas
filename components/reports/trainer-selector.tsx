"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type TrainerOption = { id: string; name: string };

export function TrainerSelector({
  trainers,
  selectedId,
}: {
  trainers: TrainerOption[];
  selectedId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(trainerId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("trainer", trainerId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full max-w-xs rounded-md border bg-background px-3 text-sm sm:w-auto"
      aria-label="Select trainer"
    >
      {trainers.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
