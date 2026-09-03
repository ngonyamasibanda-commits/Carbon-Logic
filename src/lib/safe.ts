/** Escape user text before interpolating it into HTML (print views, etc.). */
export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Allow only http(s) links. Blocks javascript:, data:, and protocol-relative tricks. */
export function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
  } catch {
    return undefined
  }
  return undefined
}

/** File attachments we created via FileReader, or a normal http(s) URL. */
export function safeDownloadUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  if (value.startsWith('data:')) {
    if (/^data:text\/html/i.test(value) || /^data:text\/javascript/i.test(value)) return undefined
    if (/^data:(image|application)\//i.test(value)) return value
    return undefined
  }
  return safeHttpUrl(value)
}
