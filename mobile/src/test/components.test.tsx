import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FilterTabs } from "@/components/intel/FilterTabs";
import { Sheet } from "@/components/sheets/Sheet";
import { ConfirmSheet } from "@/components/sheets/ConfirmSheet";
import { UiStateProvider } from "@/components/shell/UiStateProvider";
import { DaySummary } from "@/components/intel/DaySummary";
import { DAY_SUMMARY } from "@/data/fixtures";
import { TODAY_FILTERS } from "@/lib/routes";

const wrap = (ui: React.ReactNode) => render(<UiStateProvider>{ui}</UiStateProvider>);

/* ------------------------------------------------------------------ */

describe("FilterTabs", () => {
  const options = TODAY_FILTERS.map((f) => ({ key: f.key, label: f.label }));

  function Harness({ onChange }: { onChange?: (k: string) => void }) {
    const [value, setValue] = useState<(typeof options)[number]["key"]>("all");
    return (
      <FilterTabs
        label="Timeline filters"
        options={options}
        value={value}
        onChange={(k) => {
          setValue(k);
          onChange?.(k);
        }}
        resultCount={7}
      />
    );
  }

  it("exposes tab semantics with exactly one selected tab", () => {
    wrap(<Harness />);
    const tablist = screen.getByRole("tablist", { name: "Timeline filters" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs.filter((t) => t.getAttribute("aria-selected") === "true")).toHaveLength(1);
  });

  it("changes the selected filter on click", async () => {
    const onChange = vi.fn();
    wrap(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Dues" }));
    expect(onChange).toHaveBeenCalledWith("dues");
    expect(screen.getByRole("tab", { name: "Dues" })).toHaveAttribute("aria-selected", "true");
  });

  it("moves between filters with the arrow keys", async () => {
    wrap(<Harness />);
    const all = screen.getByRole("tab", { name: "All" });
    all.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Requests" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Experiences" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("announces the filtered result count politely", () => {
    wrap(<Harness />);
    expect(screen.getByRole("status")).toHaveTextContent("7 items in All");
  });

  it("keeps only one tab in the tab order (roving tabindex)", () => {
    wrap(<Harness />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */

describe("DaySummary", () => {
  it("renders three lines and applies a filter from a term", async () => {
    const onFilter = vi.fn();
    wrap(<DaySummary summary={DAY_SUMMARY} onFilter={onFilter} />);

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByTestId("day-summary").children).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "3 requests" }));
    expect(onFilter).toHaveBeenCalledWith("requests");

    await userEvent.click(screen.getByRole("button", { name: "2 arrivals" }));
    expect(onFilter).toHaveBeenCalledWith("access");
  });

  it("pluralises counts correctly", () => {
    wrap(<DaySummary summary={DAY_SUMMARY} onFilter={() => {}} />);
    expect(screen.getByRole("button", { name: "1 departure" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2 arrivals" })).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */

describe("Sheet", () => {
  function SheetHarness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open sheet
        </button>
        <Sheet open={open} onClose={() => setOpen(false)} title="Review access request">
          <button type="button">First</button>
          <button type="button">Last</button>
        </Sheet>
      </>
    );
  }

  it("is a modal dialog labelled by its title", async () => {
    wrap(<SheetHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open sheet" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Review access request");
  });

  it("traps focus and restores it to the opener on close", async () => {
    wrap(<SheetHarness />);
    const opener = screen.getByRole("button", { name: "Open sheet" });
    opener.focus();
    await userEvent.click(opener);

    // Focus moves into the sheet.
    expect(screen.getByRole("dialog")).toHaveFocus();

    // Tab cycles inside the sheet, never back to the opener.
    await userEvent.tab();
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("closes on Escape", async () => {
    wrap(<SheetHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open sheet" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */

describe("ConfirmSheet", () => {
  it("states the exact effect and offers one quiet cancel and one confirm", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    wrap(
      <ConfirmSheet
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Approve access request?"
        confirmLabel="Approve"
        facts={[
          { label: "Person", value: "Nora + 1" },
          { label: "Period", value: "29 Jul – 2 Aug" },
          { label: "Contribution", value: "€1,400" },
        ]}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Approve access request?");
    expect(screen.getByText("Nora + 1")).toBeInTheDocument();
    expect(screen.getByText("€1,400")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onConfirm).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not act until the operator confirms", () => {
    const onConfirm = vi.fn();
    wrap(
      <ConfirmSheet
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Publish Founders’ dinner?"
        facts={[{ label: "Space", value: "Terrace" }]}
      />,
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
