"use client";

/* eslint-disable @next/next/no-img-element -- The operator's portrait is a
   fixed 56px disc synced from the member portal in Phase 2; routing it through
   /_next/image would add an optimizer round trip for one small avatar. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import type { OperatorAccount, Result } from "@/data/contracts";
import { getOperatorAction, signOutAction } from "@/app/actions";
import { Icon } from "@/lib/icons";
import { Banner, StatusText } from "@/components/ui/primitives";
import { Sheet } from "./Sheet";
import { ConfirmSheet } from "./ConfirmSheet";

/**
 * Everything behind the avatar: who is signed in, what the app is connected
 * to, and the way out.
 *
 * PHASE 2 — the two things this cannot do yet:
 *   • `avatarUrl` must be synced from the member portal profile, not uploaded
 *     again here.
 *   • Changing the email needs a verification round trip that does not exist
 *     yet. The row is deliberately inert and says so, rather than pretending.
 */
export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [result, setResult] = useState<Result<OperatorAccount> | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getOperatorAction().then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const operator = result?.status === "ok" ? result.data : null;

  return (
    <>
      <Sheet
        open={open && !signingOut}
        onClose={onClose}
        title="Account"
        testId="account-sheet"
        footer={
          <button
            type="button"
            className="btn btn--destructive btn--block"
            onClick={() => setSigningOut(true)}
            data-testid="account-sign-out"
          >
            <LogOut size={17} aria-hidden="true" /> Sign out
          </button>
        }
      >
        {!operator ? (
          <p className="empty-state__body" style={{ padding: "24px 0" }}>
            Loading your account…
          </p>
        ) : (
          <>
            <div className="account-identity">
              {operator.avatarUrl ? (
                <img
                  className="account-identity__avatar"
                  src={operator.avatarUrl}
                  alt=""
                  width={56}
                  height={56}
                  decoding="async"
                />
              ) : (
                <span className="account-identity__avatar account-identity__avatar--initials">
                  {operator.initials}
                </span>
              )}
              <span style={{ minWidth: 0 }}>
                <span className="account-identity__name">{operator.name}</span>
                <span className="row__detail">{operator.roleLabel}</span>
              </span>
            </div>

            <section className="group">
              <h3 className="group__label">Sign-in</h3>
              <div className="group__panel">
                <ul className="list">
                  <li>
                    <div className="row" style={{ cursor: "default", paddingInline: 14 }}>
                      <span className="row__icon" aria-hidden="true">
                        <Icon name="message-square" size={17} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">{operator.email}</span>
                        <span className="row__detail">
                          Changing this needs email verification — not available yet
                        </span>
                      </span>
                      <span className="row__trailing">
                        <StatusText
                          label={operator.emailVerified ? "Verified" : "Unverified"}
                          tone={operator.emailVerified ? "healthy" : "attention"}
                        />
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
            </section>

            <section className="group">
              <h3 className="group__label">System</h3>
              <div className="group__panel">
                <ul className="list">
                  {operator.connections
                    .filter((c) => c.id !== "email")
                    .map((c) => {
                      const body = (
                        <>
                          <span className="row__icon" aria-hidden="true">
                            <Icon name={c.icon} size={17} />
                          </span>
                          <span className="row__body">
                            <span className="row__title">{c.label}</span>
                            <span className="row__detail">{c.detail}</span>
                          </span>
                          <span className="row__trailing">
                            {c.state.label ? (
                              <StatusText label={c.state.label} tone={c.state.tone} />
                            ) : null}
                            <ChevronRight size={17} className="row__chev" aria-hidden="true" />
                          </span>
                        </>
                      );
                      return (
                        <li key={c.id}>
                          {c.href ? (
                            <Link
                              href={c.href}
                              className="row"
                              style={{ paddingInline: 14 }}
                              onClick={onClose}
                              data-testid={`account-link-${c.id}`}
                            >
                              {body}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className="row"
                              style={{ paddingInline: 14 }}
                              data-testid={`account-link-${c.id}`}
                            >
                              {body}
                            </button>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            </section>

            <div style={{ marginTop: 16 }}>
              <Banner tone="info">
                Your picture syncs from the member portal profile. Changing your
                email needs a verification round trip — not available yet.
              </Banner>
            </div>
          </>
        )}
      </Sheet>

      <ConfirmSheet
        open={signingOut}
        onClose={() => setSigningOut(false)}
        onConfirm={() => {
          // Server-side session clear, then land on the login route. The
          // sheet never just clears local state.
          void signOutAction().finally(() => {
            setSigningOut(false);
            onClose();
            window.location.assign("/login");
          });
        }}
        title="Sign out of Open Collective?"
        confirmLabel="Sign out"
        destructive
        facts={[
          { icon: "person", label: "Account", value: operator?.name ?? "—" },
          { icon: "message-square", label: "Email", value: operator?.email ?? "—" },
          { icon: "info", label: "Effect", value: "This device is signed out" },
        ]}
      />
    </>
  );
}
