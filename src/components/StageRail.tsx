/**
 * Readiness stage rail — "Overall readiness stage" from the doc.
 *
 * A four-step rail rather than a chip, because the requirement next to it is
 * "how is my participation progressing" and "what happens next before I can
 * work independently": a pro needs to see where the stage sits in the
 * sequence, not just its name.
 *
 * The stage list and its short labels come from server/lib/readiness.ts so the
 * rail cannot drift from the values `toStage` matches against. `Historical` is
 * not a rail step — it falls through to the label-only card below.
 */
import { READINESS_STAGES, STAGE_SHORT_LABELS } from '@server/lib/readiness';

type TaskStatus = 'On Track' | 'Tasks Overdue' | null;

/** The overall status, pinned top-right of the card. Absent when it would mean nothing. */
function StatusChip({ status }: { status: TaskStatus }) {
  if (!status) return null;
  const overdue = status === 'Tasks Overdue';
  return (
    <span
      className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        overdue ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
      }`}
    >
      {status}
    </span>
  );
}

export default function StageRail({
  label: rawLabel,
  index,
  taskStatus = null,
}: {
  label: string;
  index: number | null;
  taskStatus?: TaskStatus;
}) {
  // `Historical` is the internal status for a pro who has left the program;
  // to the pro it reads as finishing, so show "Complete". Only the display
  // changes — the raw value is still what `finished` is detected from.
  const label = rawLabel === 'Historical' ? 'Complete' : rawLabel;

  // An unrecognised status is shown as-is with no rail, rather than being
  // forced onto a step it does not belong on.
  if (index === null) {
    return (
      <div className="card relative">
        <StatusChip status={taskStatus} />
        <p className="card-label">Readiness stage</p>
        <p className="card-value">{label}</p>
      </div>
    );
  }

  return (
    <div className="card relative">
      <StatusChip status={taskStatus} />
      <p className="card-label">Readiness stage</p>
      <p className="card-value">{label}</p>
      <ol className="mt-3 flex gap-1" aria-label="Readiness stages">
        {READINESS_STAGES.map((stage, i) => {
          const done = i < index;
          const current = i === index;
          // Red while tasks are overdue, so the rail agrees with the chip above it.
          const overdue = taskStatus === 'Tasks Overdue';
          return (
            <li key={stage} className="flex-1" aria-current={current ? 'step' : undefined}>
              <div
                className={`h-1.5 rounded-full ${
                  current
                    ? overdue
                      ? 'bg-red-600'
                      : 'bg-emerald-600'
                    : done
                      ? overdue
                        ? 'bg-red-300'
                        : 'bg-emerald-300'
                      : 'bg-slate-200'
                }`}
              />
              <span
                className={`mt-1 block text-[10px] leading-tight ${
                  current ? 'font-semibold text-slate-900' : 'text-slate-400'
                }`}
              >
                {STAGE_SHORT_LABELS[stage]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
