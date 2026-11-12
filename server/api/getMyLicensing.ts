/**
 * getMyLicensing — the signed-in pro's own licences and what is pending on each.
 *
 * ── Access ─────────────────────────────────────────────────────────────────
 * No input. Licence ids come from the licensing links already on the
 * signed-in EML record, so there is no way to ask for someone else's.
 *
 * The one extra field read here is PUBLIC_APPLICATION_OBSERVATION_S__C, and
 * only the tags on the PENDING_LICENSE_ACTIONS list leave the server (see
 * server/lib/licensing.ts); the rest of that text is never returned.
 */
import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { Licensing } from '../airtable/index';
import { stringList } from '../lib/readiness';
import { byUrgency, LICENCE_FIELDS, licenceView, pendingActions } from '../lib/licensing';

const outputSchema = z.object({
  licences: z.array(
    z.object({
      name: z.string().nullable(),
      state: z.string().nullable(),
      status: z.string().nullable(),
      expires: z.string().nullable(),
      pendingActions: z.array(z.string()),
    }),
  ),
});

export default createEndpoint({
  description: "The signed-in new hire's own licences, with any pending actions",
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema,
  execute: async ({ context }) => {
    const ids = stringList(context.user.licensing);
    if (!ids.length) return { licences: [] };

    const page = await Licensing.findAll({
      filters: { id: { in: ids } },
      fields: [...LICENCE_FIELDS, 'publicApplicationObservationSC'],
      limit: 100,
    });

    const licences = page.records
      .map(r => ({ ...licenceView(r), pendingActions: pendingActions(r.publicApplicationObservationSC) }))
      // Licences with something to do first, then any still in progress, so the page opens on what matters.
      .sort(byUrgency);

    return { licences };
  },
});
