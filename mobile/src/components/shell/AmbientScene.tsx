"use client";

/* BACKGROUND_SYSTEM.md prescribes the exact <picture><source webp><img png>
   layer recipe. The scene is a decorative fixed overscan layer driven by CSS
   custom properties; next/image would wrap it in its own positioned container
   and break the transform/blur contract. The bitmaps are pre-sized route
   masters, already served as WebP. */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BACKGROUND_RUNTIME as RT,
  backgroundForPath,
  type BackgroundAsset,
} from "@/lib/backgrounds";
import { useUiState } from "./UiStateProvider";

/**
 * The route-family wallpaper and its depth behaviour
 * (backgrounds/BACKGROUND_SYSTEM.md).
 *
 * Motion is caused only by scrolling, navigation or opening a sheet — there is
 * no autonomous animation loop. Scroll writes CSS custom properties straight
 * onto the node inside a rAF, so scrolling never re-renders React.
 */
export function AmbientScene() {
  const pathname = usePathname();
  const { focusDepth, prefersReducedMotion } = useUiState();
  const sceneRef = useRef<HTMLDivElement>(null);

  const asset = backgroundForPath(pathname);
  const [current, setCurrent] = useState<BackgroundAsset>(asset);
  const [outgoing, setOutgoing] = useState<BackgroundAsset | null>(null);

  /* Route-family change: hold the outgoing image while the incoming one
     crossfades underneath it. Derived during render rather than in an effect —
     an effect would paint the new wallpaper once before the crossfade starts. */
  if (asset.id !== current.id) {
    setOutgoing(current);
    setCurrent(asset);
  }

  /* Retire the held image once the crossfade has finished. */
  useEffect(() => {
    if (!outgoing) return;
    const t = window.setTimeout(() => setOutgoing(null), RT.routeTransitionMs);
    return () => window.clearTimeout(t);
  }, [outgoing]);

  /* Scroll driver — passive listener, rAF-scheduled, no idle loop. */
  useEffect(() => {
    const node = sceneRef.current;
    if (!node || prefersReducedMotion) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      const y = -(RT.scrollTravelPx / 2) + progress * RT.scrollTravelPx;
      const blur = progress * RT.scrollBlurMaxPx;
      node.style.setProperty("--scene-y", `${y.toFixed(2)}px`);
      node.style.setProperty("--scene-blur", `${blur.toFixed(2)}px`);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [prefersReducedMotion, current.id]);

  /* Optional pointer parallax, capped at ±6px, pointer devices only. */
  useEffect(() => {
    const node = sceneRef.current;
    if (!node || prefersReducedMotion) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let frame = 0;
    let nextX = 0;
    const apply = () => {
      frame = 0;
      node.style.setProperty("--scene-x", `${nextX.toFixed(2)}px`);
    };
    const onMove = (e: PointerEvent) => {
      const ratio = e.clientX / Math.max(1, window.innerWidth) - 0.5;
      nextX = ratio * RT.pointerTravelPx * 2;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [prefersReducedMotion]);

  return (
    <div
      ref={sceneRef}
      className="ambient-scene"
      aria-hidden="true"
      data-focus={focusDepth > 0 ? "true" : "false"}
      data-background={current.id}
      data-testid="ambient-scene"
    >
      <picture className="ambient-scene__picture" key={current.id}>
        <source srcSet={current.webp} type="image/webp" />
        <img
          src={current.png}
          alt=""
          decoding="async"
          style={{ objectPosition: current.objectPosition }}
        />
      </picture>

      {outgoing ? (
        <picture
          className="ambient-scene__picture ambient-scene__picture--outgoing"
          key={`out-${outgoing.id}`}
        >
          <source srcSet={outgoing.webp} type="image/webp" />
          <img
            src={outgoing.png}
            alt=""
            decoding="async"
            style={{ objectPosition: outgoing.objectPosition }}
          />
        </picture>
      ) : null}

      <div className="ambient-scene__chroma" />
      <div className="ambient-scene__veil" />
    </div>
  );
}
