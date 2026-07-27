"use client";

import { useEffect, useRef } from "react";
import type { EmbedGrant } from "@/lib/clawpanel";

// Thin React shell around ClawPanel's <clawpanel-chat> web component. The
// component loads its own script from ClawPanel (shadow DOM, no CSS bleed) and
// talks to ClawPanel's /api/chat with the short-lived embed token the server
// minted for this user. We create the custom element imperatively so we don't
// depend on global JSX typing for the tag name.
export default function ClawpanelChat({ grant }: { grant: EmbedGrant }) {
  const host = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (!scriptLoaded.current) {
      scriptLoaded.current = true;
      if (!customElements.get("clawpanel-chat")) {
        const s = document.createElement("script");
        s.src = `${grant.apiUrl}/embed/chat.js`;
        s.async = true;
        document.body.appendChild(s);
      }
    }
    const el = host.current;
    if (!el) return;
    el.innerHTML = "";
    const chat = document.createElement("clawpanel-chat");
    chat.setAttribute("base-url", grant.apiUrl);
    chat.setAttribute("agent-id", grant.agentId);
    chat.setAttribute("token", grant.token);
    chat.setAttribute("agent-name", "Collecta");
    chat.setAttribute("persona", "Open Collective operator");
    chat.style.display = "block";
    chat.style.minHeight = "480px";
    el.appendChild(chat);
  }, [grant]);

  return <div ref={host} />;
}
