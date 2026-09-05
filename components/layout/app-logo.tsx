import { APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
  variant?: "inline" | "login";
  className?: string;
};

const CREST_SRC = "/branding/impackt-crest.png";

export function AppLogo({ size = "md", variant = "inline", className }: AppLogoProps) {
  if (variant === "login") {
    return (
      <div className={cn("flex justify-center overflow-visible", className)}>
        <img
          src={CREST_SRC}
          alt={APP_NAME}
          width={512}
          height={298}
          className="h-auto w-[240px] max-w-full object-contain sm:w-[280px]"
        />
      </div>
    );
  }

  const heightClass =
    size === "lg" ? "h-14 sm:h-16" : size === "sm" ? "h-11 sm:h-12" : "h-12 sm:h-14";

  return (
    <div className={cn("flex min-w-0 items-center overflow-visible", className)}>
      <img
        src={CREST_SRC}
        alt={APP_NAME}
        width={512}
        height={298}
        className={cn("w-auto max-w-[11rem] object-contain object-left", heightClass)}
      />
    </div>
  );
}
