const GREEN = new Set(["approved", "confirmed", "paid", "published", "completed", "member", "admin", "operator"]);
const RED = new Set(["rejected", "cancelled", "archived", "declined"]);
const GOLD = new Set(["submitted", "screening", "requested", "waitlist", "waitlisted", "draft", "lead", "interested"]);

export default function StatusChip({ value }: { value: string | null | undefined }) {
  const label = value || "unknown";
  const cls = GREEN.has(label) ? "chip-green" : RED.has(label) ? "chip-red" : GOLD.has(label) ? "chip-gold" : "";
  return <span className={`chip ${cls}`}>{label.replaceAll("_", " ")}</span>;
}
