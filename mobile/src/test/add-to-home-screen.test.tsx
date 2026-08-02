import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AddToHomeScreen } from "@/components/shell/AddToHomeScreen";
import { UiStateProvider } from "@/components/shell/UiStateProvider";
import { INSTALL_STORAGE_KEY, parseInstallState } from "@/lib/install";

const UA = {
  safari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1",
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22C152 Instagram 361.0.0.25.88",
  desktopChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

function setAgent(userAgent: string, platform = "iPhone", maxTouchPoints = 5) {
  for (const [key, value] of Object.entries({ userAgent, platform, maxTouchPoints })) {
    Object.defineProperty(window.navigator, key, { value, configurable: true });
  }
}

const wrap = () =>
  render(
    <UiStateProvider>
      <AddToHomeScreen />
    </UiStateProvider>,
  );

/** Past the settle delay, in the one act() the state update belongs to. */
const settle = async () => {
  await act(async () => {
    vi.advanceTimersByTime(5_000);
  });
};

const stored = () => parseInstallState(window.localStorage.getItem(INSTALL_STORAGE_KEY));

describe("AddToHomeScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    setAgent(UA.safari);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits out the settle delay before appearing", async () => {
    wrap();
    // Arriving on the same frame as the page would read as a page element.
    expect(screen.queryByTestId("add-to-home-screen")).toBeNull();
    await settle();
    expect(screen.getByTestId("add-to-home-screen")).toBeInTheDocument();
  });

  it("names both controls and points at the first one", async () => {
    wrap();
    await settle();

    const card = screen.getByTestId("add-to-home-screen");
    expect(card).toHaveAttribute("role", "dialog");
    // By accessible name, not text: "Add to Home Screen" is deliberately also
    // the literal menu entry quoted in step 2.
    expect(card).toHaveAccessibleName("Add to Home Screen");
    expect(screen.getByText(/in the Safari toolbar/)).toBeInTheDocument();
    // The arrow is the whole point on Safari: it aims past the app's own rail
    // at the browser toolbar underneath.
    expect(card.querySelector(".a2hs__pointer")).not.toBeNull();
    expect(card.querySelector(".a2hs__glyph--share")).not.toBeNull();
  });

  it("tells an in-app browser to escape to Safari, and drops the arrow", async () => {
    setAgent(UA.instagram);
    wrap();
    await settle();

    const card = screen.getByTestId("add-to-home-screen");
    expect(card).toHaveAccessibleName("Open in Safari");
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
    // Nothing in Instagram's toolbar does this, so pointing at it would lie.
    expect(card.querySelector(".a2hs__pointer")).toBeNull();
  });

  it("stays away from desktop, which has no gesture to teach", async () => {
    setAgent(UA.desktopChrome, "MacIntel", 0);
    wrap();
    await settle();
    expect(screen.queryByTestId("add-to-home-screen")).toBeNull();
  });

  it("records the snooze on dismissal and goes quiet", async () => {
    wrap();
    await settle();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByTestId("add-to-home-screen")).toBeNull();

    const state = stored();
    expect(state.dismissals).toBe(1);
    expect(state.snoozedUntil).toBeGreaterThan(Date.now());

    // A remount inside the quiet period must not ask again.
    wrap();
    await settle();
    expect(screen.queryByTestId("add-to-home-screen")).toBeNull();
  });

  it("closes on Escape", async () => {
    wrap();
    await settle();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("add-to-home-screen")).toBeNull();
    expect(stored().dismissals).toBe(1);
  });

  it("never asks once the app has been opened from the home screen", async () => {
    Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
    wrap();
    await settle();

    expect(screen.queryByTestId("add-to-home-screen")).toBeNull();
    // Recorded, so returning to the site in Safari later stays quiet too.
    expect(stored().installed).toBe(true);

    Object.defineProperty(window.navigator, "standalone", {
      value: undefined,
      configurable: true,
    });
    wrap();
    await settle();
    expect(screen.queryByTestId("add-to-home-screen")).toBeNull();
  });

  it("opens on demand for review with ?a2hs=show, even off an iPhone", async () => {
    setAgent(UA.desktopChrome, "MacIntel", 0);
    window.history.replaceState({}, "", "/?a2hs=show");
    wrap();
    await settle();
    expect(screen.getByTestId("add-to-home-screen")).toHaveAccessibleName("Add to Home Screen");
  });

  /* --- shared links ------------------------------------------------ */

  it("an invitation outranks a snooze the operator is still inside", async () => {
    window.localStorage.setItem(
      INSTALL_STORAGE_KEY,
      JSON.stringify({ dismissals: 2, snoozedUntil: Date.now() + 29 * 86_400_000, installed: false }),
    );

    // Without the link, the ladder holds.
    wrap();
    await settle();
    expect(screen.queryByTestId("add-to-home-screen")).toBeNull();

    window.history.replaceState({}, "", "/?a2hs=invite");
    wrap();
    await settle();
    expect(screen.getByTestId("add-to-home-screen")).toBeInTheDocument();
  });

  it("an invitation still does not reach an installed app", async () => {
    window.localStorage.setItem(
      INSTALL_STORAGE_KEY,
      JSON.stringify({ dismissals: 0, snoozedUntil: null, installed: true }),
    );
    window.history.replaceState({}, "", "/?a2hs=invite&from=Don");
    wrap();
    await settle();
    expect(screen.queryByTestId("add-to-home-screen")).toBeNull();
  });

  it("names the sender when the link carries one", async () => {
    window.history.replaceState({}, "", "/?a2hs=invite&from=Ana%20Martins");
    wrap();
    await settle();
    expect(screen.getByText("Ana Martins shared this with you")).toBeInTheDocument();
  });

  it("ignores a sender name that could compose its own instruction", async () => {
    window.history.replaceState({}, "", "/?a2hs=invite&from=Security%3A%20enter%20your%20password");
    wrap();
    await settle();

    expect(screen.getByTestId("add-to-home-screen")).toBeInTheDocument();
    expect(screen.queryByText(/enter your password/i)).toBeNull();
    expect(screen.getByText("Full screen, no address bar")).toBeInTheDocument();
  });

  it("strips the install params so a refresh and a reshare stay clean", async () => {
    window.history.replaceState({}, "", "/requests?a2hs=invite&from=Don&filter=open");
    wrap();
    await settle();

    // Also what iOS below 16.4 saves as the home-screen target: an invitation
    // left in the URL would relaunch the installed app into this prompt.
    expect(window.location.search).toBe("?filter=open");
    expect(screen.getByText("Don shared this with you")).toBeInTheDocument();
  });

  it("?a2hs=reset clears a recorded snooze", async () => {
    window.localStorage.setItem(
      INSTALL_STORAGE_KEY,
      JSON.stringify({ dismissals: 3, snoozedUntil: null, installed: false }),
    );
    window.history.replaceState({}, "", "/?a2hs=reset");
    wrap();
    await settle();
    expect(stored().dismissals).toBe(0);
  });
});
