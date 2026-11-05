'use client';

/**
 * The detail sheet behind a tapped Assessments row: every answer, category
 * score and note from one assessment, then the free-text extras.
 *
 * A full-screen sheet over the page rather than a route, because the app is a
 * single mobile screen and a route would need its own back-stack and auth
 * handling for no gain. Categories are collapsed by default except the lowest
 * scoring, so the thing a pro most needs to read is open without scrolling.
 *
 * Everything shown comes pre-resolved from getMyAssessments — scores and the
 * result are Airtable formulas, passed through, never recomputed here.
 */
import { useEffect } from 'react';
import type { GetMyAssessmentsOutputType } from '@/lib/api';
import { Card, EMPTY } from '@/components/Cards';

export type AssessmentView = NonNullable<GetMyAssessmentsOutputType['self']>;

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

const CHIP: Record<Tone, string> = {
  good: 'bg-emerald-100 text-emerald-900',
  warn: 'bg-amber-100 text-amber-900',
  bad: 'bg-rose-100 text-rose-900',
  neutral: 'bg-slate-100 text-slate-700',
};

const BAR: Record<Tone, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
  neutral: 'bg-slate-300',
};

/** 85 is the base's own bar for a category in the readiness result. */
function scoreTone(score: number | null | undefined): Tone {
  if (score === null || score === undefined) return 'neutral';
  if (score >= 85) return 'good';
  if (score >= 60) return 'warn';
  return 'bad';
}

const pct = (n: number | null | undefined) => (n === null || n === undefined ? EMPTY : `${Math.round(n)}%`);

export default function AssessmentDetail({
  title,
  assessment,
  onClose,
}: {
  title: string;
  assessment: AssessmentView;
  onClose: () => void;
}) {
  // Escape closes, and the page behind must not scroll under the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // The weakest category opens first; ties and unscored ones fall back to order.
  const lowest = assessment.categories.reduce<string | null>((acc, c) => {
    if (c.score === null || c.score === undefined) return acc;
    const best = assessment.categories.find(x => x.code === acc);
    return !best || (best.score ?? 101) > c.score ? c.code : acc;
  }, null);

  const meta = [assessment.roundLabel, assessment.submittedDate ? `submitted ${assessment.submittedDate}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mx-auto flex w-full max-w-page flex-col gap-3 p-3">
        <header className="sticky top-0 z-10 -mx-3 flex items-center gap-3 bg-slate-50/95 px-3 py-2 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-black/5 active:bg-slate-100"
          >
            Back
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
            {meta ? <p className="truncate text-xs text-slate-500">{meta}</p> : null}
          </div>
        </header>

        {assessment.isCurrentRound ? null : (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-snug text-amber-900 ring-1 ring-amber-200">
            This is your previous assessment{assessment.roundLabel ? ` (${assessment.roundLabel})` : ''}. The one for{' '}
            {assessment.currentRoundLabel ?? 'the current round'} has not been submitted yet.
          </div>
        )}

        <Card>
          <p className="card-label">Overall score</p>
          <p className="card-value">{pct(assessment.overallScore)}</p>
          {assessment.result ? (
            <p className="mt-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {assessment.result.label}
              </span>
              <span className={`chip mt-1 ${CHIP[assessment.result.tone]}`}>{assessment.result.value}</span>
            </p>
          ) : null}
        </Card>

        {assessment.categories.length ? (
          assessment.categories.map(c => (
            <Card key={c.code} className="!p-0">
              <details open={c.code === lowest} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{c.name}</span>
                    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <span
                        className={`block h-full rounded-full ${BAR[scoreTone(c.score)]}`}
                        style={{ width: `${Math.max(0, Math.min(100, c.score ?? 0))}%` }}
                      />
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-11 text-right text-sm font-semibold tabular-nums text-slate-900">{pct(c.score)}</span>
                    <span className="text-slate-400 transition-transform group-open:rotate-90" aria-hidden>
                      ›
                    </span>
                  </span>
                </summary>

                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  <ul className="space-y-2">
                    {c.items.map(i => (
                      <li key={i.label} className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-slate-700">{i.label}</span>
                        <span className={`chip shrink-0 text-right ${CHIP[i.tone]}`}>{i.answer ?? EMPTY}</span>
                      </li>
                    ))}
                  </ul>
                  {c.notes ? (
                    <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm leading-snug text-slate-700">
                      {c.notes}
                    </p>
                  ) : null}
                </div>
              </details>
            </Card>
          ))
        ) : (
          <Card>
            <p className="card-note">No answers have been recorded on this assessment.</p>
          </Card>
        )}

        {assessment.extras.length ? (
          <Card>
            <dl className="space-y-3">
              {assessment.extras.map(e => (
                <div key={e.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{e.label}</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-sm leading-snug text-slate-800">{e.text}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : null}

        <div className="h-4" />
      </div>
    </div>
  );
}
