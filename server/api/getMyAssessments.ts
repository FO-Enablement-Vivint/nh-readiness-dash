/**
 * getMyAssessments — the contents behind the two Assessments rows.
 *
 * ── Access ─────────────────────────────────────────────────────────────────
 * Returns the signed-in pro's OWN NH self-assessment and the FSM Final
 * Assessment written about them. Showing the FSM's assessment contents to the
 * new hire widens the README's §9 matrix (which had FSM Assessment as `No`);
 * that is a decision recorded in the README and still to be confirmed with
 * Austi.
 *
 * What is read is an allow-list, not "everything minus a few": every field name
 * below is requested explicitly, so a field added to either table later does
 * not become visible by accident. Deliberately NOT read: Confidence Gap,
 * Eligibility Exception, Intervention Link, RM Audit and every Calibration
 * field, none of which belong on this page.
 *
 * There is no input. Assessment ids come from the pro's own Readiness Events
 * (links already on the signed-in EML record), so there is no way to ask for
 * someone else's record.
 *
 * Results (scores, readiness result, flags) are Airtable formulas and are
 * passed through, not recomputed here.
 */
import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { FsmFinalAssessment, NhSelfAssessment, ReadinessEvent } from '../airtable/index';
import type { TableDef } from '../airtable/schema.generated';
import { cleanNumber, firstString, formatDate, stringList } from '../lib/readiness';

const CATEGORY_NAMES: Record<string, string> = {
  SAF: 'Safety',
  SEC: 'Security Systems',
  LS: 'Life Safety Devices',
  HVAC: 'HVAC',
  CAM: 'Cameras',
  NET: 'Networking',
  INV: 'Inventory Management',
  HA: 'Home Automation',
  TS: 'Troubleshooting & Problem Solving',
  IND: 'Independence & Decision Making',
};

/** Order the categories appear in, regardless of field order in the base. */
const CATEGORY_ORDER = ['SAF', 'SEC', 'LS', 'HVAC', 'CAM', 'NET', 'INV', 'HA', 'TS', 'IND'];

const toneSchema = z.enum(['good', 'warn', 'bad', 'neutral']);

const assessmentSchema = z
  .object({
    roundLabel: z.string().nullable(),
    /**
     * False when this is an earlier round's assessment because the current
     * round has none submitted yet — so the page can say so instead of
     * presenting old answers under a "Ready to Start" status.
     */
    isCurrentRound: z.boolean(),
    currentRoundLabel: z.string().nullable(),
    submittedDate: z.string().nullable(),
    overallScore: z.number().nullable(),
    /** The headline outcome, e.g. the FSM's readiness result. */
    result: z.object({ label: z.string(), value: z.string(), tone: toneSchema }).nullable(),
    categories: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        score: z.number().nullable(),
        items: z.array(
          z.object({
            label: z.string(),
            answer: z.string().nullable(),
            tone: toneSchema,
          }),
        ),
        notes: z.string().nullable(),
      }),
    ),
    /** Free-text and flag fields shown under the categories. */
    extras: z.array(z.object({ label: z.string(), text: z.string() })),
  })
  .nullable();

const outputSchema = z.object({
  self: assessmentSchema,
  fsm: assessmentSchema,
});

type Assessment = NonNullable<z.infer<typeof assessmentSchema>>;

/**
 * Whether the FSM's assessment contents may be shown yet.
 *
 * UNDECIDED. This is the single place the rule lives. The placeholder shows it
 * once the FSM has submitted; the alternative under discussion is to hold it
 * until the readiness decision is made. Change only this function.
 */
function fsmResultsVisible(a: { submittedDate: unknown }): boolean {
  return Boolean(firstString(a.submittedDate));
}

/** Colour for an answer, from the base's own wording. */
function answerTone(answer: string | null): z.infer<typeof toneSchema> {
  if (!answer) return 'neutral';
  const a = answer.toLowerCase();
  if (a.includes('not confident') || a.includes('did not meet')) return 'bad';
  if (a.includes('somewhat') || a.includes('minor coaching')) return 'warn';
  if (a.includes('confident') || a.includes('consistently')) return 'good';
  return 'neutral';
}

function resultTone(value: string): z.infer<typeof toneSchema> {
  const v = value.toLowerCase();
  if (v.startsWith('not ready') || v.includes('remediation')) return 'bad';
  if (v.startsWith('awaiting')) return 'warn';
  if (v.startsWith('ready')) return 'good';
  return answerTone(value);
}

/** Item fields look like "SEC: Panel" or "SAF: PPE (Critical)"; notes end "Notes". */
const ITEM_NAME = /^([A-Z]+): (.+)$/;

/** Splits a table's per-category fields into items, notes and score keys. */
function categoryFields(def: TableDef) {
  const byCode = new Map<
    string,
    { items: Array<{ key: string; label: string }>; notesKey: string | null; scoreKey: string | null }
  >();
  const entry = (code: string) => {
    let e = byCode.get(code);
    if (!e) byCode.set(code, (e = { items: [], notesKey: null, scoreKey: null }));
    return e;
  };

  for (const f of def.fields) {
    const m = ITEM_NAME.exec(f.name);
    if (m && CATEGORY_NAMES[m[1]]) {
      const [, code, rest] = m;
      if (f.type === 'multilineText' && /notes$/i.test(rest)) entry(code).notesKey = f.key;
      else if (f.type === 'singleSelect') {
        // The base marks some items "(Critical)" in the field name; that marker
        // is not shown, so it is stripped from the label.
        entry(code).items.push({ key: f.key, label: rest.replace(/\s*\(Critical\)\s*$/i, '') });
      }
      continue;
    }
    const s = /^([A-Z]+) Score$/.exec(f.name);
    if (s && CATEGORY_NAMES[s[1]]) entry(s[1]).scoreKey = f.key;
  }
  return byCode;
}

function buildCategories(def: TableDef, record: Record<string, unknown>): Assessment['categories'] {
  const out: Assessment['categories'] = [];
  const fields = categoryFields(def);
  for (const code of CATEGORY_ORDER) {
    const c = fields.get(code);
    if (!c) continue;
    const items = c.items.map(i => {
      const answer = firstString(record[i.key]);
      return { label: i.label, answer, tone: answerTone(answer) };
    });
    const notes = c.notesKey ? firstString(record[c.notesKey]) : null;
    const score = c.scoreKey ? cleanNumber(record[c.scoreKey]) : null;
    // A category the assessment never touched adds nothing but noise.
    if (!items.some(i => i.answer) && !notes && score === null) continue;
    out.push({ code, name: CATEGORY_NAMES[code], score, items, notes });
  }
  return out;
}

/** Every field this endpoint may request from a table: categories plus `extra`. */
function allowedFields(def: TableDef, extra: string[]): string[] {
  const keys = new Set<string>(extra);
  for (const c of categoryFields(def).values()) {
    c.items.forEach(i => keys.add(i.key));
    if (c.notesKey) keys.add(c.notesKey);
    if (c.scoreKey) keys.add(c.scoreKey);
  }
  return [...keys];
}

const text = (label: string, v: unknown) => {
  const t = firstString(v);
  return t && t !== '-' ? { label, text: t } : null;
};
const flag = (label: string, v: unknown) => (v === true || v === 1 ? { label, text: 'Yes' } : null);
const compact = <T,>(xs: Array<T | null>): T[] => xs.filter((x): x is T => x !== null);

const SELF_EXTRA = ['submittedDate', 'overallScore', 'readinessStatement', 'readinessConcerns'];
const FSM_EXTRA = [
  'submittedDate',
  'overallScore',
  'fsmReadinessResult',
  'safetyCriticalNonStarter',
  'categoriesLessThan85',
  'remediationReasons',
  'unsafeWorkPracticesObserved',
  'avoidableHomeDamageObserved',
  'coachingReassessmentPlan',
  'trainingPlan',
  'reassessmentDate',
];

export default createEndpoint({
  description: "The signed-in new hire's own self-assessment and their FSM's assessment of them",
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema,
  execute: async ({ context }) => {
    const me = context.user;

    // Newest event first. Round can be blank on some events, so createdTime
    // breaks the tie rather than leaving the order to Airtable.
    const events = (
      await ReadinessEvent.findAll({
        filters: { id: { in: stringList(me.readinessEventsAsNewHire) } },
        fields: ['round', 'roundLabel', 'nhSelfAssessment', 'fsmFinalAssessment'],
        limit: 50,
      })
    ).records.sort(
      (a, b) =>
        (cleanNumber(b.round) ?? -1) - (cleanNumber(a.round) ?? -1) ||
        String(b.createdTime).localeCompare(String(a.createdTime)),
    );

    const latest = events[0] ?? null;

    // The most recent event that actually has the assessment attached: a
    // freshly opened round has none yet, and the previous round's is still the
    // latest one the pro has.
    const selfEvent = events.find(e => stringList(e.nhSelfAssessment).length);
    const fsmEvent = events.find(e => stringList(e.fsmFinalAssessment).length);

    const [selfRec, fsmRec] = await Promise.all([
      selfEvent
        ? NhSelfAssessment.findAll({
            filters: { id: { in: [stringList(selfEvent.nhSelfAssessment)[0]] } },
            fields: allowedFields(NhSelfAssessment.def, SELF_EXTRA),
            limit: 1,
          }).then(p => p.records[0] ?? null)
        : null,
      fsmEvent
        ? FsmFinalAssessment.findAll({
            filters: { id: { in: [stringList(fsmEvent.fsmFinalAssessment)[0]] } },
            fields: allowedFields(FsmFinalAssessment.def, FSM_EXTRA),
            limit: 1,
          }).then(p => p.records[0] ?? null)
        : null,
    ]);

    const self: Assessment | null =
      selfRec && selfEvent
        ? (() => {
            const r = selfRec as unknown as Record<string, unknown>;
            const statement = firstString(r.readinessStatement);
            return {
              roundLabel: firstString(selfEvent.roundLabel),
              isCurrentRound: selfEvent.id === latest?.id,
              currentRoundLabel: firstString(latest?.roundLabel),
              submittedDate: formatDate(r.submittedDate),
              overallScore: cleanNumber(r.overallScore),
              result: statement ? { label: 'Your readiness statement', value: statement, tone: 'neutral' as const } : null,
              categories: buildCategories(NhSelfAssessment.def, r),
              extras: compact([text('Your readiness concerns', r.readinessConcerns)]),
            };
          })()
        : null;

    const fsm: Assessment | null =
      fsmRec && fsmEvent && fsmResultsVisible(fsmRec as unknown as { submittedDate: unknown })
        ? (() => {
            const r = fsmRec as unknown as Record<string, unknown>;
            const result = firstString(r.fsmReadinessResult);
            return {
              roundLabel: firstString(fsmEvent.roundLabel),
              isCurrentRound: fsmEvent.id === latest?.id,
              currentRoundLabel: firstString(latest?.roundLabel),
              submittedDate: formatDate(r.submittedDate),
              overallScore: cleanNumber(r.overallScore),
              result: result ? { label: 'Readiness result', value: result, tone: resultTone(result) } : null,
              categories: buildCategories(FsmFinalAssessment.def, r),
              extras: compact([
                firstString(r.safetyCriticalNonStarter) === 'Yes'
                  ? { label: 'Safety-critical item', text: 'One or more safety-critical items did not meet expectations.' }
                  : null,
                flag('Unsafe work practices observed', r.unsafeWorkPracticesObserved),
                flag('Avoidable home damage observed', r.avoidableHomeDamageObserved),
                text('Categories under 85%', r.categoriesLessThan85),
                text('Remediation reasons', r.remediationReasons),
                text('Coaching / reassessment plan', r.coachingReassessmentPlan),
                text('Training plan', r.trainingPlan),
                text('Reassessment date', formatDate(r.reassessmentDate)),
              ]),
            };
          })()
        : null;

    return { self, fsm };
  },
});
