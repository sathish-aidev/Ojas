import Image from "next/image";
import { APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
  /** Larger mark for login screen */
  variant?: "inline" | "login";
  className?: string;
};

const iconSizes = { sm: 32, md: 40, lg: 48 };

export function AppLogo({ size = "md", variant = "inline", className }: AppLogoProps) {
  if (variant === "login") {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <Image
          src="/branding/logo.png"
          alt={APP_NAME}
          width={200}
          height={200}
          unoptimized
          priority
          className="h-24 w-auto max-w-[220px] object-contain"
        />
        <span className="text-2xl font-semibold tracking-tight text-foreground">{APP_NAME}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/branding/logo.png"
        alt=""
        aria-hidden
        width={iconSizes[size]}
        height={iconSizes[size]}
        unoptimized
        priority
        className="h-9 w-9 shrink-0 rounded-lg object-contain sm:h-10 sm:w-10"
      />
      <span
        className={cn(
          "font-semibold tracking-tight text-foreground",
          size === "sm" ? "text-base" : "text-lg"
        )}
      >
        {APP_NAME}
      </span>
    </div>
  );
}
