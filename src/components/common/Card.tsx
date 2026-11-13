import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * A plain surface: token background, border, radius and shadow. For a titled section with actions use
 * DataCard (AdminKit); for a figure use StatTile.
 */
export function Card({ className, padded = true, ...rest }: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return <div className={cn("ui_card", padded && "is_padded", className)} {...rest} />;
}
