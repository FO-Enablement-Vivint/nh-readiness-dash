// Registry of every endpoint exposed at POST /api/<name>.
// Add a file to server/api and list it here to expose it.
//
// There is no role branching: the doc's §9 matrix gives the NH role "Own" and
// nothing else, so every endpoint is scoped to the caller's own EML record by
// the gate in server/lib/eml.ts.
import getMyAssessments from './getMyAssessments';
import getMyLicensing from './getMyLicensing';
import getMyFieldExperience from './getMyFieldExperience';
import getMyReadiness from './getMyReadiness';

export const endpoints = {
  getMyAssessments,
  getMyFieldExperience,
  getMyLicensing,
  getMyReadiness,
};

export type Endpoints = typeof endpoints;
export type EndpointName = keyof Endpoints;
