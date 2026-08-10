"use client";

import Image from "next/image";
import { useState } from "react";

const SIZES = {
  sm: { box: "h-10 w-10", text: "text-[15px]", px: 40 },
  md: { box: "h-12 w-12", text: "text-[17px]", px: 48 },
  lg: { box: "h-20 w-20", text: "text-[26px]", px: 80 },
  xl: { box: "h-24 w-24", text: "text-[30px]", px: 96 },
} as const;

/** Member avatar with champagne-initials fallback. */
export default function Avatar({
  url,
  first,
  last,
  size = "md",
  className = "",
}: {
  url?: string | null;
  first?: string | null;
  last?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const [failed, setFailed] = useState(false);

  // Initials only when there is no photo or the photo fails to load — never
  // a broken-image icon. (onError needs a client component to serialize.)
  if (url && !failed) {
    return (
      <span
        className={`relative block ${s.box} shrink-0 overflow-hidden rounded-full border border-white/15 ${className}`}
      >
        <Image
          src={url}
          alt=""
          fill
          sizes={`${s.px}px`}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span
      className={`flex ${s.box} shrink-0 items-center justify-center rounded-full bg-champagne/20 ${s.text} font-semibold text-champagne ${className}`}
    >
      {(first?.[0] || "").toUpperCase()}
      {(last?.[0] || "").toUpperCase()}
    </span>
  );
}
