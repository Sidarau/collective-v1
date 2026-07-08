"use client";

import { useEffect } from "react";

/** Remove sensitive query params (?minted=…) from the URL/history after render. */
export default function StripQuery() {
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  return null;
}
