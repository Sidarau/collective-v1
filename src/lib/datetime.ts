/**
 * All experience times render in the Gate's timezone, 24h clock — never the
 * server's (Vercel = UTC) or the viewer's device. Single-gate MVP: Ibiza.
 */
export const GATE_TZ = "Europe/Madrid";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: GATE_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: GATE_TZ,
  month: "short",
  day: "numeric",
});

const weekdayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: GATE_TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const monthFmt = new Intl.DateTimeFormat("en-GB", { timeZone: GATE_TZ, month: "short" });
const dayNumFmt = new Intl.DateTimeFormat("en-GB", { timeZone: GATE_TZ, day: "numeric" });

/** "20:00" */
export const fmtGateTime = (iso: string) => timeFmt.format(new Date(iso));
/** "10 Jul" */
export const fmtGateDay = (iso: string) => dayFmt.format(new Date(iso));
/** "Fri, 10 Jul" */
export const fmtGateWeekday = (iso: string) => weekdayFmt.format(new Date(iso));
/** "10 Jul, 20:00" */
export const fmtGateDayTime = (iso: string) => `${dayFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))}`;
/** "Jul" */
export const fmtGateMonth = (iso: string) => monthFmt.format(new Date(iso));
/** "10" */
export const fmtGateDayNum = (iso: string) => dayNumFmt.format(new Date(iso));
