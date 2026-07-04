import ImagesField from "@/components/ImagesField";
import { saveEventAction } from "@/lib/content-actions";
import { DEFAULT_TIMEZONE } from "@core/scheduling";
import type { EventRow, VillaRow } from "@core/database.types";

/** UTC ISO → villa wall-clock "YYYY-MM-DDTHH:MM" for datetime-local inputs. */
function toMadridLocal(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

export default function EventForm({
  event,
  gates,
}: {
  event: EventRow | null;
  gates: Pick<VillaRow, "id" | "name">[];
}) {
  return (
    <form action={saveEventAction} className="space-y-4">
      {event && <input type="hidden" name="id" value={event.id} />}
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="label">Title</label>
          <input name="title" required defaultValue={event?.title || ""} className="input" />
        </div>
        <div>
          <label className="label">Type</label>
          <select name="eventType" defaultValue={event?.event_type || "gathering"} className="input">
            <option value="dinner">Dinner</option>
            <option value="experience">Experience</option>
            <option value="session">Session</option>
            <option value="gathering">Gathering</option>
            <option value="wellness">Wellness</option>
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={event?.status || "draft"} className="input">
            <option value="draft">Draft — hidden</option>
            <option value="published">Published — members see it</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="label">Starts (Ibiza clock)</label>
          <input
            name="startAt"
            type="datetime-local"
            required
            defaultValue={toMadridLocal(event?.start_at || null)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Ends (optional)</label>
          <input
            name="endAt"
            type="datetime-local"
            defaultValue={toMadridLocal(event?.end_at || null)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Capacity</label>
          <input name="capacity" type="number" min="1" defaultValue={event?.capacity || ""} className="input" placeholder="∞" />
        </div>
        <div>
          <label className="label">Gate</label>
          <select name="villaId" defaultValue={event?.villa_id || ""} className="input">
            <option value="">No gate — general</option>
            {gates.map((gate) => (
              <option key={gate.id} value={gate.id}>
                {gate.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Location note</label>
        <input
          name="locationNote"
          defaultValue={event?.location_note || ""}
          className="input"
          placeholder="The long table on the upper terrace"
        />
      </div>

      <div>
        <label className="label">Description</label>
        <textarea name="description" defaultValue={event?.description || ""} className="input" rows={4} />
      </div>

      <ImagesField name="image" initial={event?.image ? [event.image] : []} single label="Cover photo" />

      <button type="submit" className="btn btn-gold">
        {event ? "Save event" : "Create event"}
      </button>
    </form>
  );
}
