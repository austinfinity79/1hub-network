/**
 * Route-group boundary for the WF04/WF05 demo group (architecture 04 A1:
 * `/demo/*`). Like every group it organises layouts only; each demo layout and
 * API authorizes on the server.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <div data-route-group="demo">{children}</div>
}
