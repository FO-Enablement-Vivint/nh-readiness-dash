'use client';

/**
 * Licensing — each licence the pro holds and anything still pending on it.
 *
 * Linked to from the status chips on the Licensing card. Licensing is not a
 * readiness requirement, so nothing here blocks or counts toward readiness.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiClientError, getMyLicensing, type GetMyLicensingOutputType } from '@/lib/api';
import { Card, EMPTY } from '@/components/Cards';

type Licence = GetMyLicensingOutputType['licences'][number];

export default function Licensing() {
  const [licences, setLicences] = useState<Licence[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyLicensing({})
      .then(d => !cancelled && setLicences(d.licences))
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : 'Something went wrong loading your licensing.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-3 p-3">
      <header className="px-1 pt-1">
        <Link href="/" className="text-sm font-medium text-emerald-700 hover:underline">
          ‹ My readiness
        </Link>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Licensing</h1>
        <p className="text-sm text-slate-500">Licensing does not affect your readiness.</p>
      </header>

      {error ? (
        <Card>
          <p className="text-sm leading-relaxed text-slate-700">{error}</p>
        </Card>
      ) : !licences ? (
        <p className="card-note px-1">Loading your licensing…</p>
      ) : !licences.length ? (
        <Card>
          <p className="card-label">Licensing</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">Not on file</p>
          <p className="card-note">No licence on record.</p>
        </Card>
      ) : (
        licences.map((l, i) => <LicenceCard key={`${l.name}-${i}`} licence={l} />)
      )}
      <div className="h-2" />
    </main>
  );
}

function LicenceCard({ licence: l }: { licence: Licence }) {
  const active = (l.status || '').toLowerCase() === 'active';
  return (
    <Card>
      <p className="card-label">{l.state || 'Licence'}</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold leading-snug text-slate-900">{l.name || EMPTY}</h2>
        <span
          className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            active ? 'border-emerald-600 text-emerald-700' : 'border-amber-600 text-amber-700'
          }`}
        >
          {l.status || 'Needs attention'}
        </span>
      </div>
      {l.expires ? <p className="card-note">Expires {l.expires}</p> : null}

      <div className="mt-3 border-t border-slate-100 pt-3">
        {l.pendingActions.length ? (
          <>
            <p className="card-label">What you need to do</p>
            <p className="mt-1 text-sm text-slate-500">These are for you to complete.</p>
            <ul className="mt-2 space-y-1.5">
              {l.pendingActions.map(a => (
                <li key={a} className="flex items-start gap-2 text-sm text-slate-800">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {a}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="card-label">Nothing for you to do</p>
            <p className="mt-1 text-sm text-slate-500">
              {active
                ? 'This licence is active. There is nothing you need to do.'
                : 'This licence is still in progress, but there is nothing you need to do right now.'}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
