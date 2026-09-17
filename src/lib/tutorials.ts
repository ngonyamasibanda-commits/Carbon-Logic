export type TutorialStep = {
  title: string
  body: string
}

export type TutorialTopic = {
  id: string
  title: string
  outcome: string
  steps: TutorialStep[]
  /** Silent walkthrough video under /public/tutorials */
  videoSrc: string
  videoPoster?: string
}

const DATA_ENTRY_STEPS: TutorialStep[] = [
  {
    title: 'Choose the site',
    body: 'Assign the entry to a construction site, mine, processing plant, depot, or warehouse in Additional Data. Manage sites under Facilities or Organisation.',
  },
  {
    title: 'Enter activity data',
    body: 'Fill the category fields (fuel litres, tonne-km, material tonnes, and so on). The amount must be greater than zero.',
  },
  {
    title: 'Add evidence',
    body: 'Attach bills or delivery notes, add custom fields such as project codes, and tag the row for later filtering.',
  },
  {
    title: 'Calculate',
    body: 'Click Calculate & add to footprint. tCO₂e = (Activity Amount × Conversion Value) / 1000.',
  },
  {
    title: 'Review and export',
    body: 'Open Analysis for trends and intensity, then Combined Results for the reporting inventory and PDF export.',
  },
]

export const TUTORIALS = {
  'data-entry': {
    id: 'data-entry',
    title: 'Log emissions',
    outcome: 'Add a calculated emissions row to your organisation footprint.',
    steps: DATA_ENTRY_STEPS,
    videoSrc: '/tutorials/data-entry.webm',
  },
  organization: {
    id: 'organization',
    title: 'Organisation setup',
    outcome: 'Complete the reporting setup checklist so intensity and baseline metrics work.',
    steps: [
      {
        title: 'Name and country',
        body: 'Confirm the organisation display name and country of operation. These appear on reports and intensity wording.',
      },
      {
        title: 'Annual turnover',
        body: 'Enter annual turnover in pounds. Analysis uses this for the SECR intensity ratio (tCO₂e per £ million).',
      },
      {
        title: 'Baseline YTD',
        body: 'Set a baseline year-to-date total so the dashboard can show reduction progress.',
      },
      {
        title: 'Work the checklist',
        body: 'Tick items complete automatically when you add a facility, log emissions, set baseline, enter turnover, and save a science-based target.',
      },
    ],
    videoSrc: '/tutorials/organization.webm',
  },
  sbti: {
    id: 'sbti',
    title: 'Science based targets',
    outcome: 'Configure a near-term and net-zero pathway that passes the modelled SBTi checks.',
    steps: [
      {
        title: 'Fill the inventory',
        body: 'Use logged emissions for the base year and most recent year, or untick the box and enter scope totals manually.',
      },
      {
        title: 'Set the years',
        body: 'Pick base, most-recent, target (5–10 years out), submission, and net-zero years. The tool aligns years to your inventory when possible.',
      },
      {
        title: 'Choose Scope 3 ambition',
        body: 'Select 1.5°C or well-below 2°C for Scope 3. Coverage and Scope 2 approach affect the criteria checks.',
      },
      {
        title: 'Review checks and save',
        body: 'Read the criteria checklist, copy the target language if needed, then Save target so Organisation setup can mark this step complete.',
      },
    ],
    videoSrc: '/tutorials/sbti.webm',
  },
} as const satisfies Record<string, TutorialTopic>

export type TutorialId = keyof typeof TUTORIALS

export function getTutorial(id: TutorialId): TutorialTopic {
  return TUTORIALS[id]
}
