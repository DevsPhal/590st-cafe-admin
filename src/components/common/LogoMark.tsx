import Image from "next/image";
import { cn } from "@/lib/utils";

// The black logo on light screens and the white one on dark screens. CSS picks between them from the
// theme class next-themes sets before the first paint, so the right one shows with no flash.
export function LogoMark({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <>
      <Image
        src="/logos/logo-black.png"
        alt="590st CAFE"
        width={800}
        height={539}
        className={cn("block dark:hidden", className)}
        priority
      />
      <Image
        src="/logos/logo-white.png"
        alt="590st CAFE"
        width={800}
        height={539}
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}
