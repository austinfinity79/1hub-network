/**
 * M0-T03 — content width wrapper.
 *
 * The only structural primitive the shell needs before any approved screen
 * exists. Spacing uses Tailwind defaults because the Design SOT defers spacing
 * tokens (section 2.5); no 1hub spacing value is invented here.
 */
export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10" data-shell="page-container">
      {children}
    </div>
  )
}
