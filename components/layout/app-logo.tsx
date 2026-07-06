import Image from "next/image";
import { APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const iconSizes = { sm: 32, md: 40, lg: 56 };
const textSizes = { sm: "text-base", md: "text-lg", lg: "text-2xl" };

/** Single brand mark: icon + gym name text (not two separate logo images). */
export function AppLogo({ size = "md", className }: AppLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/branding/logo.png"
        alt=""
        aria-hidden
        width={iconSizes[size]}
        height={iconSizes[size]}
        className="rounded-lg object-contain"
        priority
      />
      <span className={cn("font-semibold tracking-tight text-foreground", textSizes[size])}>
        {APP_NAME}
      </span>
    </div>
  );
}
