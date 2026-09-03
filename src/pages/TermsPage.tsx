import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogoLockup } from '../components/brand/Logo'

const LAST_UPDATED = '3 September 2026'
const LEGAL_EMAILS = ['founders@usecarbonlogic.com', 'founders@carbonlogichq.com'] as const

const SECTIONS = [
  { id: 'acceptance', title: '1. Acceptance of these terms' },
  { id: 'service', title: '2. Nature of the service' },
  { id: 'disclaimer', title: '3. Disclaimer of warranties' },
  { id: 'calculator', title: '4. Emissions calculations and methodologies' },
  { id: 'advice', title: '5. No professional, legal, or audit advice' },
  { id: 'user-duties', title: '6. Your responsibilities' },
  { id: 'liability', title: '7. Limitation of liability' },
  { id: 'indemnity', title: '8. Indemnity' },
  { id: 'ip', title: '9. Intellectual property' },
  { id: 'acceptable-use', title: '10. Acceptable use' },
  { id: 'accounts', title: '11. Accounts and security' },
  { id: 'privacy', title: '12. Privacy and data protection' },
  { id: 'rights', title: '13. Your data rights' },
  { id: 'fees', title: '14. Fees, refunds, and cooling-off' },
  { id: 'termination', title: '15. Suspension and termination' },
  { id: 'law', title: '16. Governing law and disputes' },
  { id: 'general', title: '17. General provisions' },
  { id: 'contact', title: '18. Contact' },
]

export default function TermsPage() {
  return (
    <div className="min-h-svh bg-page">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <LogoLockup width={140} />
          </Link>
          <Link to="/" className="text-sm font-medium text-brand hover:underline">
            Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-muted">Legal</p>
        <h1 className="mt-1 text-3xl font-bold text-ink">Terms &amp; Conditions</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          These Terms govern access to and use of the Carbon Logic platform, including our website,
          applications, calculators, emission-factor libraries, science-based target tools, reports,
          and related services (together, the &ldquo;Service&rdquo;). By creating an account,
          accessing, or using the Service, you agree to be bound by these Terms. If you do not
          agree, do not use the Service.
        </p>
        <p className="mt-2 text-xs text-muted">Last updated: {LAST_UPDATED}</p>

        <nav className="mt-8 rounded-xl border border-line bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Contents</h2>
          <ol className="mt-3 columns-1 gap-x-8 text-sm text-brand sm:columns-2">
            {SECTIONS.map((section) => (
              <li key={section.id} className="mb-1.5 break-inside-avoid">
                <a href={`#${section.id}`} className="hover:underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="mt-8 space-y-8 text-sm leading-7 text-ink">
          <Section id="acceptance" title="1. Acceptance of these terms">
            <p>
              These Terms form a legally binding agreement between you (the individual user and, where
              applicable, the organisation you represent) and Carbon Logic (&ldquo;Carbon Logic&rdquo;,
              &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). If you use the Service on
              behalf of a company or other legal entity, you represent that you have authority to bind
              that entity, and &ldquo;you&rdquo; includes that entity.
            </p>
            <p>
              We may update these Terms from time to time. Material changes will be indicated by
              revising the &ldquo;Last updated&rdquo; date. Continued use after changes take effect
              constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section id="service" title="2. Nature of the service">
            <p>
              Carbon Logic provides software tools intended to help construction and logistics
              organisations estimate, organise, analyse, and report greenhouse-gas (GHG) emissions
              and related sustainability metrics. The Service is a decision-support and record-keeping
              aid. It does not replace professional carbon accounting, assurance, legal advice, or
              regulatory filings prepared by qualified advisers.
            </p>
            <p>
              Features may include activity data entry, emission-factor libraries, dashboards,
              analysis exports, science-based target modelling, multi-user access, and documentation
              aids. We may add, modify, or withdraw features without prior notice where reasonably
              necessary for product, security, or legal reasons.
            </p>
          </Section>

          <Section id="disclaimer" title="3. Disclaimer of warranties">
            <p>
              The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
              To the maximum extent permitted by applicable law, Carbon Logic and its officers,
              directors, employees, contractors, and suppliers disclaim all warranties and
              representations of any kind, whether express, implied, statutory, or otherwise,
              including without limitation implied warranties of merchantability, fitness for a
              particular purpose, title, non-infringement, accuracy, completeness, reliability, and
              uninterrupted or error-free operation.
            </p>
            <p>
              We do not warrant that the Service will meet your requirements, that results will be
              accepted by any regulator, auditor, customer, or standard-setting body, or that defects
              will be corrected. You assume all risk arising from use of the Service and reliance on
              any outputs.
            </p>
          </Section>

          <Section id="calculator" title="4. Emissions calculations and methodologies">
            <p>
              Emission estimates are generated using activity data you supply and conversion factors
              drawn from published sources (including, where applicable, UK DESNZ/DEFRA GHG conversion
              factors, ICE Database values, and other third-party datasets) and/or factors you upload
              or configure yourself.
            </p>
            <p>
              We take reasonable care in curating default factors and documenting sources, but we do
              not guarantee that any factor, formula, unit conversion, science-based target pathway,
              intensity metric, or report is free from error, omission, or outdated values. Factors
              and methodologies change over time. You remain solely responsible for verifying that
              factors, boundaries, and methods are appropriate for your reporting purpose before
              relying on them for disclosure, tenders, contractual commitments, or assurance.
            </p>
            <p>
              Where the Service presents calculation breakdowns, pathway charts, or target language,
              those outputs are illustrative modelling aids only. They do not constitute validation
              by the Science Based Targets initiative (SBTi), CDP, ISO bodies, or any other third
              party.
            </p>
          </Section>

          <Section id="advice" title="5. No professional, legal, or audit advice">
            <p>
              Nothing in the Service constitutes legal, financial, tax, engineering, environmental
              consultancy, assurance, or auditing advice. Guidance pages, learning materials, and FAQs
              are general information only. You must obtain independent professional advice before
              making decisions with regulatory, contractual, or financial consequences.
            </p>
          </Section>

          <Section id="user-duties" title="6. Your responsibilities">
            <p>You agree that you will:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>provide accurate, complete, and lawfully obtained activity and organisational data;</li>
              <li>maintain appropriate evidence and audit trails for your own reporting obligations;</li>
              <li>configure sites, roles, factors, and organisational boundaries correctly;</li>
              <li>not upload unlawful, infringing, or confidential data you are not authorised to process;</li>
              <li>comply with all laws applicable to your use of the Service and your GHG disclosures;</li>
              <li>keep account credentials confidential and promptly report suspected unauthorised access.</li>
            </ul>
            <p>
              You acknowledge that emissions outputs are only as reliable as the inputs and
              assumptions you choose. Carbon Logic is not responsible for under-reporting,
              over-reporting, or mis-scoped inventories arising from user error, incomplete data, or
              incorrect factor selection.
            </p>
          </Section>

          <Section id="liability" title="7. Limitation of liability">
            <p>
              To the fullest extent permitted by law, Carbon Logic shall not be liable for any
              indirect, incidental, special, consequential, exemplary, or punitive damages, or for
              any loss of profits, revenue, data, goodwill, business opportunity, anticipated savings,
              or cost of substitute services, whether arising in contract, tort (including
              negligence), statute, or otherwise, even if advised of the possibility of such damages.
            </p>
            <p>
              Without limiting the foregoing, Carbon Logic shall not be liable for any claim arising
              from: (a) reliance on calculator outputs, emission factors, or reports; (b) third-party
              datasets or services; (c) interruptions, downtime, or data loss; (d) decisions made by
              you or third parties based on Service outputs; or (e) acts or omissions of users within
              your organisation.
            </p>
            <p>
              Subject to non-excludable statutory rights, our aggregate liability arising out of or
              relating to the Service or these Terms shall not exceed the greater of (i) the total
              fees you paid to Carbon Logic for the Service in the twelve (12) months immediately
              preceding the claim, or (ii) one hundred pounds sterling (£100).
            </p>
            <p>
              Nothing in these Terms excludes or limits liability for death or personal injury caused
              by negligence, fraud or fraudulent misrepresentation, or any other liability that cannot
              be excluded or limited under English law.
            </p>
          </Section>

          <Section id="indemnity" title="8. Indemnity">
            <p>
              You agree to defend, indemnify, and hold harmless Carbon Logic and its officers,
              employees, and agents from and against any claims, damages, losses, liabilities, costs,
              and expenses (including reasonable legal fees) arising out of or related to: (a) your
              use of the Service; (b) your data, content, or disclosures; (c) your breach of these
              Terms; (d) your violation of law or third-party rights; or (e) any report, filing,
              tender response, or public statement you make using Service outputs.
            </p>
          </Section>

          <Section id="ip" title="9. Intellectual property">
            <p>
              The Service—including software, interfaces, documentation, logos, trademarks, text,
              graphics, factor catalogues as curated and presented, calculation logic, and
              compilations—is owned by Carbon Logic or its licensors and is protected by UK and
              international intellectual-property laws. We grant you a limited, non-exclusive,
              non-transferable, revocable licence to use the Service solely for your internal
              business purposes in accordance with these Terms.
            </p>
            <p>
              You may not copy, modify, distribute, sell, lease, reverse engineer (except to the
              extent such restriction is prohibited by law), frame, scrape, or create derivative works
              from the Service or its content without our prior written consent. &ldquo;Carbon
              Logic&rdquo; and associated marks and branding are trademarks of Carbon Logic. You may
              not use them in a manner likely to cause confusion or to disparage Carbon Logic.
            </p>
            <p>
              You retain ownership of data you submit. You grant us a worldwide, non-exclusive
              licence to host, process, transmit, and display that data solely as needed to operate
              and improve the Service, provide support, and meet legal obligations.
            </p>
          </Section>

          <Section id="acceptable-use" title="10. Acceptable use">
            <p>You must not:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>attempt to gain unauthorised access to systems, accounts, or data;</li>
              <li>interfere with security, availability, or integrity of the Service;</li>
              <li>use the Service to develop a competing product by systematic extraction of content;</li>
              <li>misrepresent Service outputs as independently verified or certified when they are not;</li>
              <li>use the Service for unlawful, deceptive, or harmful purposes.</li>
            </ul>
          </Section>

          <Section id="accounts" title="11. Accounts and security">
            <p>
              You are responsible for all activity under your account and for implementing appropriate
              access controls within your organisation (including role assignments and multi-factor
              authentication where available). We may suspend access where we reasonably believe
              credentials are compromised or these Terms are breached.
            </p>
          </Section>

          <Section id="privacy" title="12. Privacy and data protection">
            <p>
              This section explains how we handle personal data in connection with the Service, in
              line with the UK GDPR and the Data Protection Act 2018 (and, where applicable, the EU
              GDPR).
            </p>
            <p>
              <strong>Who we are.</strong> Carbon Logic provides carbon-accounting software for
              construction and logistics organisations. For personal data processed to operate
              accounts and the platform, Carbon Logic acts as a controller (or joint controller with
              your organisation where you administer workspace membership). For activity and emissions
              data you enter about your business operations, your organisation is typically the
              controller and we process that data as a processor on your instructions.
            </p>
            <p>
              <strong>Personal data we may process.</strong> Account identifiers (name, email),
              authentication and security data, organisation membership and role, usage and technical
              logs (including IP address and device/browser metadata), support correspondence, and
              any personal data you choose to place in comments, file uploads, or custom fields.
            </p>
            <p>
              <strong>Purposes and legal bases.</strong> We process personal data to: provide and
              secure the Service (contract / legitimate interests); manage accounts and
              organisations (contract); comply with law (legal obligation); improve reliability and
              prevent abuse (legitimate interests); and, where required, with your consent (for
              example certain optional communications), which you may withdraw at any time.
            </p>
            <p>
              <strong>Cookies and similar technologies.</strong> We use essential cookies and local
              storage needed for authentication, session security, and core product function. We do
              not sell personal data. Browser settings may block non-essential storage, which can
              affect Service functionality.
            </p>
            <p>
              <strong>Sharing.</strong> We may share personal data with infrastructure and service
              providers that process data on our behalf (for example hosting, authentication, and
              email delivery), subject to appropriate contractual protections. We may disclose data
              where required by law, regulation, court order, or to protect rights, safety, and
              security. We do not sell or broker personal data.
            </p>
            <p>
              <strong>International transfers.</strong> Where data is transferred outside the UK/EEA,
              we use appropriate safeguards (such as adequacy decisions or standard contractual
              clauses) as required by law.
            </p>
            <p>
              <strong>Retention.</strong> We retain account and workspace data for as long as your
              organisation uses the Service and thereafter for a period reasonably necessary to meet
              legal, accounting, dispute, and security obligations (typically up to six years where
              relevant under English limitation periods, unless a longer or shorter period is
              required). You may request deletion subject to legal retention needs.
            </p>
            <p>
              <strong>Security.</strong> We apply technical and organisational measures appropriate
              to the risk, including access controls and encrypted transport. No method of
              transmission or storage is completely secure; you use the Service at your own risk in
              that regard.
            </p>
          </Section>

          <Section id="rights" title="13. Your data rights">
            <p>Subject to applicable law, data subjects may have the right to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>access a copy of personal data we hold;</li>
              <li>rectify inaccurate or incomplete personal data;</li>
              <li>request erasure in certain circumstances;</li>
              <li>restrict or object to certain processing;</li>
              <li>data portability where processing is automated and based on consent or contract;</li>
              <li>withdraw consent where processing is consent-based;</li>
              <li>lodge a complaint with the UK Information Commissioner&apos;s Office (ICO).</li>
            </ul>
            <p>
              To exercise these rights, contact us at{' '}
              {LEGAL_EMAILS.map((email, index) => (
                <span key={email}>
                  {index > 0 ? ' or ' : null}
                  <a className="text-brand hover:underline" href={`mailto:${email}`}>
                    {email}
                  </a>
                </span>
              ))}
              . We may need to verify your identity before responding. We aim to respond within one
              month. If you are not satisfied with our response, you may complain to the ICO (
              <a
                className="text-brand hover:underline"
                href="https://ico.org.uk"
                target="_blank"
                rel="noreferrer"
              >
                ico.org.uk
              </a>
              ).
            </p>
          </Section>

          <Section id="fees" title="14. Fees, refunds, and cooling-off">
            <p>
              Where paid plans or professional services are offered, fees, billing periods, and
              cancellation terms will be stated at the point of purchase or in a separate order form.
              Except where mandatory consumer law provides otherwise, fees are non-refundable once
              access to paid features has been granted.
            </p>
            <p>
              If you are a consumer entitled to a statutory cooling-off period for distance
              contracts, you may cancel within fourteen (14) days of purchase unless you have
              expressly requested immediate performance and acknowledged that you lose the right to
              cancel once digital content or service delivery has begun. Business customers waive any
              cooling-off rights to the extent permitted by law.
            </p>
            <p>Nothing in this section affects non-excludable statutory rights.</p>
          </Section>

          <Section id="termination" title="15. Suspension and termination">
            <p>
              You may stop using the Service at any time. We may suspend or terminate access
              immediately if you materially breach these Terms, create risk to the Service or other
              users, or fail to pay applicable fees. Upon termination, your licence ends. Sections
              that by their nature should survive (including disclaimers, liability limits, indemnity,
              IP, and governing law) will survive termination.
            </p>
          </Section>

          <Section id="law" title="16. Governing law and disputes">
            <p>
              These Terms and any dispute or claim (including non-contractual disputes or claims)
              arising out of or in connection with them or their subject matter are governed by the
              laws of England and Wales. The courts of England and Wales shall have exclusive
              jurisdiction, except that we may seek injunctive or other urgent relief in any
              jurisdiction to protect our intellectual property or confidential information.
            </p>
          </Section>

          <Section id="general" title="17. General provisions">
            <p>
              If any provision of these Terms is held unenforceable, the remaining provisions remain
              in full force. Our failure to enforce a provision is not a waiver. You may not assign
              these Terms without our consent; we may assign them in connection with a reorganisation,
              merger, or sale of assets. These Terms constitute the entire agreement between you and
              Carbon Logic regarding the Service and supersede prior understandings on that subject.
              Force majeure events beyond our reasonable control excuse delayed performance for the
              duration of the event.
            </p>
          </Section>

          <Section id="contact" title="18. Contact">
            <p>
              Legal, privacy, and data-rights notices for Carbon Logic may be sent to{' '}
              {LEGAL_EMAILS.map((email, index) => (
                <span key={email}>
                  {index > 0 ? ' or ' : null}
                  <a className="text-brand hover:underline" href={`mailto:${email}`}>
                    {email}
                  </a>
                </span>
              ))}
              .
            </p>
            <p className="text-xs text-muted">
              These Terms are designed to allocate risk clearly between Carbon Logic and users of
              software tools. They are not a substitute for tailored legal advice. If you need terms
              customised for a specific corporate structure, insurance programme, or regulated
              offering, consult a qualified solicitor.
            </p>
          </Section>
        </article>
      </main>
    </div>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-xl border border-line bg-white p-6">
      <h2 className="text-lg font-semibold text-brand">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}
