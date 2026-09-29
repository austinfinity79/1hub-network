/**
 * WF05 — the demo route map (architecture 04 A2 + the WF05 plan): the list
 * (S01) and one venture (S02). The application screens moved to the member
 * routes in TASK 24.4 (`@/lib/application/routes`, HD-A10); their old paths
 * redirect.
 */

export const PROJECT_DEMO_PATH = '/demo/projects'

export const projectDemoRoutes = {
  list: () => PROJECT_DEMO_PATH,
  detail: (ventureId: string) => `${PROJECT_DEMO_PATH}/${encodeURIComponent(ventureId)}`,
} as const
