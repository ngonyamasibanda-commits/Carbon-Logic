import { BookOpen, GraduationCap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useOrg } from '../../providers/OrgProvider'

export default function Header() {
  const { profile } = useOrg()
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || 'H'

  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b border-line bg-white px-6">
      <Link
        to="/learn"
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-page"
      >
        <BookOpen size={13} className="text-brand" />
        Learning Hub
      </Link>
      <Link to="/learn" aria-label="Open learning hub">
        <GraduationCap size={18} className="text-muted" />
      </Link>
      <Link
        to="/sites"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white"
        aria-label={`Signed in as ${profile.displayName}`}
      >
        {initial}
      </Link>
    </header>
  )
}
