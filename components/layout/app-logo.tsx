import Image from "next/image";
import { APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
};

const sizes = {
  sm: { icon: 32, nameH: 24, nameW: 80 },
  md: { icon: 40, nameH: 28, nameW: 96 },
  lg: { icon: 56, nameH: 36, nameW: 120 },
};

export function AppLogo({ size = "md", showName = true, className }: AppLogoProps) {
  const dim = sizes[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/branding/logo.png"
        alt={`${APP_NAME} logo`}
        width={dim.icon}
        height={dim.icon}
        className="rounded-lg object-contain"
        priority
      />
      {showName && (
        <Image
          src="/branding/name.png"
          alt={APP_NAME}
          width={dim.nameW}
          height={dim.nameH}
          className="hidden h-auto w-auto max-h-7 object-contain sm:block"
          priority
        />
      )}
    </div>
  );
}
