"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { initials } from "@/lib/welcomeToast";

/**
 * A person's profile photo (their own upload, or the one synced from Telegram), shown the same way everywhere.
 * With no photo, or one that fails to load, it falls back to the person's initials.
 */
export function UserAvatar({
  src,
  name,
  sizes,
  alt = "",
  className,
  children,
}: {
  src?: string | null;
  name?: string | null;
  /** Rendered width, for next/image, e.g. "36px". */
  sizes: string;
  /** Empty by default: the name is almost always shown right beside the photo. */
  alt?: string;
  className?: string;
  /** Overlays such as an upload spinner. */
  children?: ReactNode;
}) {
  // Remember which URL failed rather than a flag, so a newly synced photo gets a fresh chance to load.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const photo = src && src !== failedSrc ? src : null;
  const letters = name?.trim() ? initials(name) : "";

  return (
    <span
      className={cn(
        "relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
        className,
      )}
    >
      {photo ? (
        <Image
          src={photo}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          onError={() => setFailedSrc(photo)}
        />
      ) : letters ? (
        <span aria-hidden>{letters}</span>
      ) : (
        <UserRound className="h-1/2 w-1/2" strokeWidth={1.75} aria-hidden />
      )}
      {children}
    </span>
  );
}
