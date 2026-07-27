"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { getProvider } from "@/data/provider";
import { FIXTURE_TODAY } from "@/data/fixtures";
import { ComposerSheet } from "@/components/sheets/ComposerSheet";
import { CollectaOrb, CollectaSheet } from "@/components/sheets/CollectaSheet";
import { UndoToast } from "@/components/ui/primitives";
import { useUiState } from "./UiStateProvider";

/**
 * The champagne add control and Collecta's portrait.
 *
 * Both retire while scrolling and return after rest, so a floating control
 * never covers a status or amount once the page is still.
 */
export function FloatingStack({
  showAdd = true,
  filter,
}: {
  showAdd?: boolean;
  filter?: string;
}) {
  const { isScrolling, visibleDate } = useUiState();
  const [composerOpen, setComposerOpen] = useState(false);
  const [collectaOpen, setCollectaOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // The add flow defaults to the date currently visible in the timeline.
  const defaultDate = visibleDate ?? FIXTURE_TODAY;

  return (
    <>
      <div
        className="floating-stack"
        data-retired={isScrolling ? "true" : "false"}
        data-testid="floating-stack"
      >
        {showAdd ? (
          <button
            type="button"
            className="add-fab"
            onClick={() => setComposerOpen(true)}
            aria-label={`Add — defaults to ${defaultDate}`}
            data-testid="add-fab"
            data-default-date={defaultDate}
          >
            <Plus size={26} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : null}

        {/* The portrait speaks for itself — a caption under it only adds noise
            over the timeline. Her name lives on the sheet she opens. */}
        <CollectaOrb onOpen={() => setCollectaOpen(true)} />
      </div>

      <ComposerSheet
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        options={getProvider().getComposerOptions()}
        defaultDate={defaultDate}
        onCreated={(_, title) => setToast(`${title} added`)}
      />

      <CollectaSheet
        open={collectaOpen}
        onClose={() => setCollectaOpen(false)}
        filter={filter}
      />

      {/* Undo is offered only for reversible, low-risk local writes. */}
      {toast ? <UndoToast message={toast} onUndo={() => setToast(null)} /> : null}
    </>
  );
}
