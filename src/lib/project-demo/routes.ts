/**
 * WF05 — the demo route map (architecture 04 A2 + the WF05 plan). Screens are
 * added by their own tasks (S01–S04); until then a route has no page and is the
 * ordinary 404, and nothing links to it (DEC-WF05-G2).
 */

export const PROJECT_DEMO_PATH = '/demo/projects'

export const projectDemoRoutes = {
  list: () => PROJECT_DEMO_PATH,
  detail: (ventureId: string) => `${PROJECT_DEMO_PATH}/${encodeURIComponent(ventureId)}`,
  application: (ventureId: string, programmeId: string) =>
    `${PROJECT_DEMO_PATH}/${encodeURIComponent(ventureId)}/applications/${encodeURIComponent(programmeId)}`,
  review: (ventureId: string, programmeId: string) =>
    `${projectDemoRoutes.application(ventureId, programmeId)}/review`,
} as const
