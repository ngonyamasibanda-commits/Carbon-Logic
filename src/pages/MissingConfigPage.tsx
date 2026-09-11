export default function MissingConfigPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-page px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-brand to-accent" />
        <div className="px-7 py-7">
          <h1 className="text-xl font-semibold text-brand">App is not configured</h1>
          <p className="mt-2 text-sm text-muted">
            This build was compiled without Supabase keys, so nobody can sign in. That usually
            happens when a <strong className="font-medium text-ink">Preview</strong> deployment is
            rebuilt. The customer site is the row labelled{' '}
            <strong className="font-medium text-ink">Production</strong> — do not Redeploy Preview
            to update it.
          </p>
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-ink">
            <li>Open the Vercel project → Settings → Environment Variables</li>
            <li>
              Add <code className="rounded bg-page px-1">VITE_SUPABASE_URL</code> and{' '}
              <code className="rounded bg-page px-1">VITE_SUPABASE_ANON_KEY</code>
            </li>
            <li>
              Enable all three environments: Production, Preview, and Development (same values as
              your local <code className="rounded bg-page px-1">.env</code>)
            </li>
            <li>
              Deployments → filter to <strong className="font-medium">Production</strong> → Redeploy
              that row, and uncheck “Use existing Build Cache”
            </li>
          </ol>
          <p className="mt-5 text-sm text-muted">
            New Production builds are created by pushing GitHub branch <code className="rounded bg-page px-1">main</code>.
            Other branches only create Preview.
          </p>
        </div>
      </div>
    </div>
  )
}
