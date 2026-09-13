export type TitleCard = {
  eyebrow: string
  title: string
  subtitle: string
}

export type Scene = {
  id: string
  chapter: string
  caption: string
  voice: string
  route?: string
  titleCard?: TitleCard
  demo?: boolean
}

export const SCENES: Scene[] = [
  {
    id: 'title',
    chapter: 'Welcome',
    caption: 'A guided tour of the real product',
    titleCard: {
      eyebrow: 'Carbon Logic',
      title: 'How to use the app',
      subtitle: 'Construction, mining, and logistics carbon accounting',
    },
    voice:
      'Welcome to Carbon Logic. This short tour shows you the real product — how to sign in, set up a workspace, log activity, and download the reports your board and auditors will ask for.',
  },
  {
    id: 'login',
    chapter: 'Sign in',
    caption: 'Password, magic link, or company SSO',
    route: '/login',
    demo: false,
    voice:
      'You start on the sign-in screen. Use a password, ask for an email link, or choose your company’s single sign-on. If a colleague invited you, create the account with that exact email, so you join the right organisation.',
  },
  {
    id: 'dashboard',
    chapter: 'Dashboard',
    caption: 'This year’s footprint, completeness, and dual Scope 2',
    route: '/',
    demo: true,
    voice:
      'Once you are in, the dashboard is home. It shows this year’s reported tonnes of CO2 equivalent, the change versus last year and your baseline, and how complete the inventory is. Scope 3 sits beside location-based and market-based Scope 2 — both are required for UK SECR.',
  },
  {
    id: 'facilities',
    chapter: 'Facilities',
    caption: 'Sites, mines, plants, and depots',
    route: '/facilities',
    demo: true,
    voice:
      'Add facilities first. Construction sites, mines, processing plants, depots, warehouses, and offices. Every activity can be assigned to a site, and those names then appear on the dashboard and in Analysis filters.',
  },
  {
    id: 'organisation',
    chapter: 'Organisation',
    caption: 'Reporting year, baseline, turnover, year-end close',
    route: '/organisation',
    demo: true,
    voice:
      'Organisation settings hold the reporting year, baseline, turnover, and headcount. Those figures feed intensity ratios and the Carbon Reduction Plan. An administrator can close a year so nobody quietly edits a filed inventory.',
  },
  {
    id: 'input',
    chapter: 'Data input',
    caption: 'Every category, grouped by Scope 1, 2, and 3',
    route: '/input',
    demo: true,
    voice:
      'Data input lists every category by greenhouse-gas scope. Search if you like, then open the one that matches the work — site fuel, electricity, haulage, or embodied carbon in materials.',
  },
  {
    id: 'fuel-empty',
    chapter: 'Log activity',
    caption: 'Site Fuel uses published DESNZ 2026 rows',
    route: '/input/site_fuel',
    demo: true,
    voice:
      'Here is Site Fuel. The form uses the published DESNZ 2026 fuel list. Choose the fuel the site actually burned, the published unit, and the amount from the invoice or tank dip.',
  },
  {
    id: 'fuel-working',
    chapter: 'Log activity',
    caption: 'The working is visible before you save',
    route: '/input/site_fuel',
    demo: true,
    voice:
      'As soon as there is an amount, Carbon Logic shows the working. Activity times the conversion factor, divided by one thousand, in tonnes of CO2 equivalent. Nothing is a black box.',
  },
  {
    id: 'fuel-evidence',
    chapter: 'Log activity',
    caption: 'Site, date, and evidence sit beside the form',
    route: '/input/site_fuel',
    demo: true,
    voice:
      'On the right, assign the facility, the date the activity happened, and a link to the evidence — a fuel invoice, a delivery note, a sharepoint file. That is what an auditor will ask to see.',
  },
  {
    id: 'fuel-saved',
    chapter: 'Log activity',
    caption: 'Calculate and add the row to the inventory',
    route: '/input/site_fuel',
    demo: true,
    voice:
      'Calculate and add to footprint saves the row to this organisation’s inventory. Colleagues see the same numbers. You can also add well-to-tank as a separate Scope 3 line when you need a complete fuel picture.',
  },
  {
    id: 'analysis',
    chapter: 'Analysis',
    caption: 'Hotspots, filters, and a leadership PDF',
    route: '/analysis',
    demo: true,
    voice:
      'Analysis is for decisions. Switch between scope and source, filter by site, month, or tag, and export a CSV or a management PDF when you brief leadership.',
  },
  {
    id: 'combined',
    chapter: 'Inventory',
    caption: 'The GHG Protocol table, including empty categories',
    route: '/combined',
    demo: true,
    voice:
      'Combined Results is the GHG Protocol inventory. Scope 1, Scope 2, and all fifteen Scope 3 categories — including empty ones — so a disclosure looks complete.',
  },
  {
    id: 'reports',
    chapter: 'Reports',
    caption: 'SECR, PPN 06/21, inventory PDF, auditor CSV',
    route: '/reports',
    demo: true,
    voice:
      'Reports packages the documents you actually attach. A SECR statement, a PPN 06/21 Carbon Reduction Plan for government tenders, the inventory PDF, and an auditor CSV of every activity.',
  },
  {
    id: 'targets',
    chapter: 'Targets',
    caption: 'SBTi pathway from the live inventory',
    route: '/targets',
    demo: true,
    voice:
      'Science Based Targets uses the SBTi dynamic linear reduction method. Set a base year and a target year, and the pathway is calculated from your live inventory — not a spreadsheet on someone’s laptop.',
  },
  {
    id: 'learn',
    chapter: 'Learning',
    caption: 'Scopes, PAS 2080, SECR, and sector tips',
    route: '/learn',
    demo: true,
    voice:
      'The Learning Hub and FAQs explain scopes, PAS 2080, well-to-tank, and practical tips for construction, mining, and logistics. Use them when a new colleague joins the workspace.',
  },
  {
    id: 'close',
    chapter: 'You are ready',
    caption: 'Set up, log with evidence, review, report',
    titleCard: {
      eyebrow: 'Next step',
      title: 'You are ready to start',
      subtitle: 'Set up the organisation · log activity with evidence · download the report pack',
    },
    voice:
      'That is the path. Set up the organisation, log activity with evidence, review the inventory, and download the report pack. You are ready to start.',
  },
]
