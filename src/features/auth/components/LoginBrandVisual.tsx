"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";

type Poster = { src: string; width: number; height: number };

// The café's own posters. Swap these files (or paths) to change the artwork; nothing else depends on them.
const LOGIN_POSTERS = {
  hero: { src: "/images/login/590st-iced-coffee-poster-dark.jpg", width: 853, height: 1280 },
  supporting: { src: "/images/login/590st-iced-coffee-poster-light.jpg", width: 853, height: 1280 },
} satisfies Record<string, Poster>;

function PosterPrint({ poster, alt, className }: { poster: Poster; alt: string; className: string }) {
  // A missing or broken image becomes a plain branded tile, so the panel never shows a broken icon.
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={cn(
        "absolute overflow-hidden rounded-2xl ring-1 ring-black/5",
        failed && "grid place-items-center bg-(--cafe-espresso)",
        className,
      )}
      style={{ aspectRatio: `${poster.width} / ${poster.height}` }}
    >
      {failed ? (
        <Image src="/logos/logo-white.png" alt="" width={800} height={539} className="h-auto w-1/2 opacity-90" />
      ) : (
        <Image
          src={poster.src}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 420px, 0px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export function LoginBrandVisual() {
  const { t } = useI18n();
  return (
    <figure className="relative flex h-full w-full flex-col overflow-hidden rounded-[22px] bg-(--cafe-panel) bg-[radial-gradient(120%_85%_at_72%_18%,var(--cafe-glow-1)_0%,var(--cafe-glow-2)_52%,var(--cafe-glow-3)_100%)]">
      {/* Sized with container units so the two prints keep their arrangement at any panel size. */}
      <div className="relative min-h-0 flex-1 @container-[size]">
        {/* The supporting print tucks in on the left so both posters keep their "590st CAFE" title in view. */}
        <PosterPrint
          poster={LOGIN_POSTERS.supporting}
          alt=""
          className="top-1/2 left-1/2 w-[min(42cqw,40cqh)] -translate-x-full translate-y-[-60%] -rotate-6 shadow-[0_24px_48px_-24px_color-mix(in_srgb,var(--shadow-espresso)_45%,transparent)]"
        />
        <PosterPrint
          poster={LOGIN_POSTERS.hero}
          alt={t("auth.login.visual.hero_alt", "590st Cafe poster: iced soda, iced latte and iced americano in 590st cups")}
          className="top-1/2 left-1/2 w-[min(52cqw,54cqh)] translate-x-[-27%] translate-y-[-46%] rotate-3 shadow-[0_36px_64px_-28px_color-mix(in_srgb,var(--shadow-espresso)_65%,transparent)]"
        />
      </div>
      <figcaption className="px-8 pt-2 pb-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-(--cafe-caramel-deep) uppercase">
          {t("auth.login.visual.eyebrow", "590st Cafe · Phnom Penh")}
        </p>
        <p className="mt-1.5 text-xl leading-snug font-semibold text-(--cafe-espresso)">
          {t("auth.login.visual.caption", "Crafted for your everyday ritual.")}
        </p>
      </figcaption>
    </figure>
  );
}
