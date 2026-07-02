import type { CrmEntityType } from "@core/database.types";
import { addNoteAction, addFollowUpAction } from "@/lib/actions";

interface Props {
  entityType: CrmEntityType;
  entityId: string;
  path: string;
}

/** Note + follow-up composers shared by every detail page. */
export default function CrmPanel({ entityType, entityId, path }: Props) {
  return (
    <div className="space-y-4">
      <form action={addNoteAction} className="panel p-4">
        <input type="hidden" name="entityType" value={entityType} />
        <input type="hidden" name="entityId" value={entityId} />
        <input type="hidden" name="path" value={path} />
        <label className="label" htmlFor="note-body">
          Add note
        </label>
        <textarea id="note-body" name="body" className="input" placeholder="Internal — visible to operators only" />
        <div className="mt-2 flex justify-end">
          <button type="submit" className="btn">
            Save note
          </button>
        </div>
      </form>

      <form action={addFollowUpAction} className="panel p-4">
        <input type="hidden" name="entityType" value={entityType} />
        <input type="hidden" name="entityId" value={entityId} />
        <input type="hidden" name="path" value={path} />
        <label className="label" htmlFor="fu-title">
          Set follow-up
        </label>
        <input id="fu-title" name="title" className="input" placeholder="e.g. Chase host call" />
        <div className="mt-2 flex items-center justify-between gap-2">
          <input type="date" name="dueAt" className="input max-w-[160px]" />
          <button type="submit" className="btn">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
