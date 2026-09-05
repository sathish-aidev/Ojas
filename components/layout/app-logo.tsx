import { Oswald } from "next/font/google";
import { APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "700"],
});

const SHIELD =
  "M200 14C112 22 74 42 66 70L54 90V156C54 186 108 228 200 286C292 228 346 186 346 156V90L334 70C326 42 288 22 200 14Z";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
  variant?: "inline" | "login";
  className?: string;
};

function MarkSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M60 6C28 12 16 24 13 40L8 52V72C8 88 28 102 60 116C92 102 112 88 112 72V52L107 40C104 24 92 12 60 6Z"
        fill="#F15A22"
      />
      <path
        transform="translate(36 42)"
        fill="#FFFFFF"
        d="M0-9L2.5-2.8H9L3.9 1.1L6 7.5L0 3.5L-6 7.5L-3.9 1.1L-9-2.8H-2.5Z"
      />
      <path
        transform="translate(84 42)"
        fill="#FFFFFF"
        d="M0-9L2.5-2.8H9L3.9 1.1L6 7.5L0 3.5L-6 7.5L-3.9 1.1L-9-2.8H-2.5Z"
      />
      <path d="M22 62H98" stroke="#FFFFFF" strokeWidth="3" />
      <path d="M26 70H94" stroke="#FFFFFF" strokeWidth="1.8" />
    </svg>
  );
}

function CrestSvg({ className, label }: { className?: string; label: string }) {
  const font = oswald.style.fontFamily;
  return (
    <svg
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={label}
    >
      <defs>
        <clipPath id="impackt-crest-clip">
          <path d={SHIELD} />
        </clipPath>
      </defs>
      <path d={SHIELD} fill="#FFFFFF" />
      <g clipPath="url(#impackt-crest-clip)">
        <rect x="48" y="8" width="304" height="88" fill="#F15A22" />
        <path
          transform="translate(118 54)"
          fill="#FFFFFF"
          d="M0-12L3.4-3.7H12L5.3 1.4L8 10L0 4.6L-8 10L-5.3 1.4L-12-3.7H-3.4Z"
        />
        <path
          transform="translate(282 54)"
          fill="#FFFFFF"
          d="M0-12L3.4-3.7H12L5.3 1.4L8 10L0 4.6L-8 10L-5.3 1.4L-12-3.7H-3.4Z"
        />
        <path d="M70 106H330" stroke="#F15A22" strokeWidth="3.5" />
        <path d="M78 116H322" stroke="#F15A22" strokeWidth="2" />
      </g>
      <path d={SHIELD} fill="none" stroke="#F15A22" strokeWidth="10" strokeLinejoin="round" />
      <text
        x="200"
        y="180"
        textAnchor="middle"
        fill="#141414"
        fontFamily={font}
        fontSize="48"
        fontWeight="700"
        letterSpacing="3"
      >
        IMPACKT
      </text>
      <text
        x="200"
        y="216"
        textAnchor="middle"
        fill="#141414"
        fontFamily={font}
        fontSize="16"
        fontWeight="500"
        letterSpacing="4.5"
      >
        FITNESS STUDIO
      </text>
      <line x1="269" y1="210" x2="286" y2="210" stroke="#141414" strokeWidth="2.2" />
    </svg>
  );
}

export function AppLogo({ variant = "inline", className }: AppLogoProps) {
  if (variant === "login") {
    return (
      <div className={cn("flex justify-center", className)}>
        <CrestSvg
          label={APP_NAME}
          className="h-36 w-auto max-w-[280px] sm:h-40 sm:max-w-[320px]"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)} aria-label={APP_NAME}>
      <MarkSvg className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
      <span
        className={cn(
          oswald.className,
          "truncate text-lg font-bold tracking-[0.12em] text-foreground sm:text-xl"
        )}
      >
        IMPACKT
      </span>
    </div>
  );
}
