/**
 * DEC-LEGAL-V1-D5 — the one legal entry point of an acceptance statement.
 *
 * Where the product asks the member to accept the legal documents, it shows a
 * single link with this exact label (PO decision). The two documents stay
 * separate: the link opens the current terms through the version-less route
 * (/legal/terms, DEC-LEGAL-D2), and the legal reader links both documents.
 */
export const COMBINED_LEGAL_LABEL = 'Điều khoản sử dụng & Chính sách quyền riêng tư'

export const COMBINED_LEGAL_HREF = '/legal/terms'

export function CombinedLegalLink({ className }: { className?: string }) {
  return (
    <a
      href={COMBINED_LEGAL_HREF}
      target="_blank"
      rel="noopener"
      className={className}
      data-legal-combined
    >
      {COMBINED_LEGAL_LABEL}
    </a>
  )
}
