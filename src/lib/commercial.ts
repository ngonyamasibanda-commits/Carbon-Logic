/** Inventory capabilities shown on Organisation settings. No public price. */
export const PROFESSIONAL_PLAN = {
  name: 'Workspace',
  summary:
    'A shared GHG Protocol inventory for one construction, mining, or logistics organisation: official UK factors, dual Scope 2, year-end close, and SECR / PPN 06/21 report packs.',
  includes: [
    'Unlimited colleagues in one organisation (owner, administrator, editor, viewer)',
    'DESNZ/DEFRA 2026 conversion factors with supplier EPDs for materials that have no published row',
    'Location- and market-based Scope 2 (SECR dual reporting)',
    'Reporting-year close so signed inventories cannot be quietly edited',
    'GHG Protocol inventory, SECR statement, and PPN 06/21 Carbon Reduction Plan',
    'SBTi near-term and net-zero modeller',
    'Audit log of access changes and inventory writes',
    'CSV and printable PDF exports for auditors and customers',
  ],
  notIncluded: [
    'Third-party verification or limited-assurance opinion',
    'File hosting for invoices (use a SharePoint or Drive evidence link)',
  ],
} as const
