import { APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";
import Link from "next/link";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
  variant?: "inline" | "login";
  href?: string;
  className?: string;
};

const CREST_SRC = "/branding/impackt-crest.png";

export function AppLogo({ size = "md", variant = "inline", href, className }: AppLogoProps) {
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
    size === "lg" ? "h-14 sm:h-16" : size === "sm" ? "h-9 sm:h-11" : "h-10 sm:h-12";

  const mark = (
    <img
      src={CREST_SRC}
      alt={href ? "" : APP_NAME}
      width={512}
      height={298}
      className={cn("w-auto max-w-[9rem] object-contain object-left sm:max-w-[11rem]", heightClass)}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn("flex min-h-11 min-w-0 items-center overflow-visible", className)}
        aria-label={`${APP_NAME} home`}
      >
        {mark}
      </Link>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center overflow-visible", className)} aria-label={APP_NAME}>
      {mark}
    </div>
  );
}
