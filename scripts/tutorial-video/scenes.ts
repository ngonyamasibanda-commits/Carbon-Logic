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
      'Welcome to Carbon Logic. This is the real product — I will click through it with you: how you sign in, set up a workspace, log activity, and download the reports your board and auditors will ask for.',
  },
  {
    id: 'login',
    chapter: 'Sign in',
    caption: 'Password, magic link, or company SSO',
    route: '/login',
    voice:
      'You land on sign in. Type your work email, then choose a password, an email link, or your company’s single sign-on. If a colleague invited you, create the account with that exact email so you join the right organisation.',
  },
  {
    id: 'dashboard',
    chapter: 'Dashboard',
    caption: 'This year’s footprint, completeness, and dual Scope 2',
    route: '/',
    voice:
      'After you sign in, this is home. The dashboard shows this year’s tonnes of CO2 equivalent, the change versus last year and your baseline, and how complete the inventory is. Scroll and you will see Scope 3 beside location-based and market-based Scope 2 — both are required for UK SECR.',
  },
  {
    id: 'facilities',
    chapter: 'Facilities',
    caption: 'Add the sites work actually happens on',
    route: '/facilities',
    voice:
      'Open Facilities. Add the construction site, mine, plant, or depot. I am typing a new site now. Every activity can be assigned to a facility, and those names then show up on the dashboard and in Analysis filters.',
  },
  {
    id: 'organisation',
    chapter: 'Organisation',
    caption: 'Reporting year, baseline, turnover, year-end close',
    route: '/organisation',
    voice:
      'Organisation settings hold the reporting year, baseline, turnover, and headcount. Those figures feed intensity ratios and the Carbon Reduction Plan. An administrator can close a year so nobody quietly edits a filed inventory.',
  },
  {
    id: 'input',
    chapter: 'Data input',
    caption: 'Search a category, then open it',
    route: '/input',
    voice:
      'Data input lists every category by greenhouse-gas scope. Search for the work you have in front of you — I will look up site fuel — then open that card.',
  },
  {
    id: 'fuel',
    chapter: 'Log activity',
    caption: 'Choose the fuel, type the amount, add evidence, save',
    route: '/input/site_fuel',
    voice:
      'This is Site Fuel. Choose the DESNZ fuel the site actually burned, the published unit, and type the litres from the invoice. The working appears as you type: activity times the factor, divided by one thousand. Assign the facility, paste a link to the evidence, then click Calculate and add to footprint. The row is saved to this organisation’s inventory.',
  },
  {
    id: 'analysis',
    chapter: 'Analysis',
    caption: 'Filter the view, switch the chart, export',
    route: '/analysis',
    voice:
      'Analysis is for decisions. Filter by site, switch the chart from scope to source, and export a CSV when you brief leadership.',
  },
  {
    id: 'combined',
    chapter: 'Inventory',
    caption: 'The GHG Protocol table, including empty categories',
    route: '/combined',
    voice:
      'Combined Results is the GHG Protocol inventory. Scope 1, Scope 2, and all fifteen Scope 3 categories — including empty ones — so a disclosure looks complete.',
  },
  {
    id: 'reports',
    chapter: 'Reports',
    caption: 'SECR, PPN 06/21, inventory PDF, auditor CSV',
    route: '/reports',
    voice:
      'Reports packages the documents you actually attach. A SECR statement, a PPN 06/21 Carbon Reduction Plan, the inventory PDF, and an auditor CSV of every activity.',
  },
  {
    id: 'targets',
    chapter: 'Targets',
    caption: 'SBTi pathway from the live inventory',
    route: '/targets',
    voice:
      'Science Based Targets uses the SBTi dynamic linear reduction method. Set a base year and a target year, and the pathway is calculated from your live inventory — not a spreadsheet on someone’s laptop.',
  },
  {
    id: 'learn',
    chapter: 'Learning',
    caption: 'Scopes, PAS 2080, SECR, and sector tips',
    route: '/learn',
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
