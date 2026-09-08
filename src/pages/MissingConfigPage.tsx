export default function MissingConfigPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-page px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-brand to-accent" />
        <div className="px-7 py-7">
          <h1 className="text-xl font-semibold text-brand">App is not configured</h1>
          <p className="mt-2 text-sm text-muted">
            This deployment was built without Supabase keys, so the page cannot sign anyone in.
            Add these variables in Vercel, then redeploy.
          </p>
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-ink">
            <li>Open the Vercel project → Settings → Environment Variables</li>
            <li>
              Add <code className="rounded bg-page px-1">VITE_SUPABASE_URL</code> and{' '}
              <code className="rounded bg-page px-1">VITE_SUPABASE_ANON_KEY</code> for Production
            </li>
            <li>Use the same values as your local <code className="rounded bg-page px-1">.env</code> file</li>
            <li>Deployments → Redeploy the latest production deployment (rebuild, do not reuse the old build)</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
