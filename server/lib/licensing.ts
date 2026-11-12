/**
 * Licence helpers shared by the card on the readiness page and the /licensing
 * page.
 *
 * Licensing is not a readiness requirement: nothing here feeds nextAction.ts or
 * readiness.ts, and it must stay that way.
 */
import { firstString, formatDate } from './readiness';

/**
 * The tasks a pro can have pending on a licence. They arrive as tags in
 * PUBLIC_APPLICATION_OBSERVATION_S__C (a single-line text field holding a
 * `;`-separated list, e.g. "Missing Livescan;Missing training"). Only tags on
 * this list are surfaced; the rest of that field ("License attached",
 * "Verified license online", "Application Sent to State", …) is progress
 * notes and state-side status, not something the pro does.
 *
 * The strings are shown to the pro exactly as written here.
 */
export const PENDING_LICENSE_ACTIONS = [
  'Missing Badge',
  'Missing Birth Certificate',
  'Missing Citizenship Documents',
  'Missing Clearance Card',
  'Missing DOB',
  'Missing driver’s license',
  'Missing Employment history',
  'Missing finger prints',
  'Missing Livescan',
  'Missing Notary',
  'Missing Passport',
  'Missing Photo',
  'Missing POB',
  'Missing receipt for Clearance Card Application Number',
  'Missing Residence History',
  'Missing Signature',
  'Missing Social Security Card',
  'Missing training',
  'Waiting for certificate',
  'Waiting for Login',
  'Signed up for training',
  'Incomplete Application',
  'Did not answer CH question',
  'See Licensing Notes',
  'Missing criminal history docs',
  'Missing Narrative',
  'Completed Application Sent to Employee',
] as const;

/** Case-, spacing- and apostrophe-insensitive, so "Missing driver's license" matches too. */
const key = (s: string) => s.replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

const ACTION_BY_KEY = new Map<string, string>(PENDING_LICENSE_ACTIONS.map(a => [key(a), a]));

/** The pending actions in a raw observation string, in the order written, without repeats. */
export function pendingActions(raw: unknown): string[] {
  const text = firstString(raw);
  if (!text) return [];
  const found: string[] = [];
  for (const part of text.split(';')) {
    const action = ACTION_BY_KEY.get(key(part));
    if (action && !found.includes(action)) found.push(action);
  }
  return found;
}

/** Fields every licence read needs, plus the one the pending actions come from. */
export const LICENCE_FIELDS = [
  'licenseName',
  'licenseStateAbbr',
  'licenseStatus',
  'licenseStatusC',
  'expirationDateC',
] as const;

/**
 * Sort order for a list of licences: anything with tasks pending first, then
 * anything not yet active, then the rest; by name within each group.
 */
export function byUrgency(
  a: { name: string | null; status: string | null; pendingActions?: string[] },
  b: { name: string | null; status: string | null; pendingActions?: string[] },
) {
  const rank = (l: typeof a) => (l.pendingActions?.length ? 0 : (l.status || '').toLowerCase() === 'active' ? 2 : 1);
  return rank(a) - rank(b) || (a.name || '').localeCompare(b.name || '');
}

/** One Licensing record as the pro sees it. */
export function licenceView(r: any) {
  const expiry = firstString(r.expirationDateC);
  return {
    name: firstString(r.licenseName),
    state: firstString(r.licenseStateAbbr),
    // `License Status` is the maintained field ("Active" / "In Progress"). The
    // older LICENSE_STATUS__C ("Active" / "Started/Not yet active") maps to it
    // one-to-one, so it is only a fallback for a blank.
    status: firstString(r.licenseStatus) || firstString(r.licenseStatusC),
    // A licence that has not started carries a placeholder expiry of
    // 2000-01-01 (409 of the first 6,000 records), which is not a date the
    // pro should be shown. Anything dated 2000 or earlier is treated as none.
    expires: expiry && Number(expiry.slice(0, 4)) > 2000 ? formatDate(expiry) : null,
  };
}
