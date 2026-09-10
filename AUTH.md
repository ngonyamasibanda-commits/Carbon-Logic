# Authentication and access control

## What you need to do

The application now refuses to render anything until someone is signed in, and the
database refuses to return anything the signed-in user is not entitled to. Three steps
get you from here to a working login.

### 1. Run the migration

Open the Supabase SQL editor and run these in order:

1. `supabase/migrations/0001_auth_and_tenancy.sql`
2. `supabase/migrations/0002_quotas_and_hardening.sql`
3. `supabase/migrations/0003_ip_rate_limits.sql`
4. `supabase/migrations/0004_platform_owner_access.sql`
5. `supabase/migrations/0005_org_scoped_entries.sql`
6. `supabase/migrations/0006_saas_cloud_workspace.sql`

They are idempotent, so re-running is safe.

If the live database already has organisations / memberships (0001) but you have not run the later files, do **not** paste `0006` or `fix_saas_workspace.sql` on their own. Those files raise write limits on `org_quotas`, which is created in 0002. Paste `supabase/fix_live_database.sql` once instead — it is 0002 through 0006.

If a run stops with `memberships_user_id_profiles_fkey` / `Key (user_id)=(...) is not present in table "profiles"`, paste `supabase/fix_memberships_profiles.sql` first, then `fix_live_database.sql`. A membership exists for an auth user who never got a `profiles` row; the SQL editor is not a superuser, so FORCE RLS otherwise blocks the backfill.

If a run stops with `relation "public.org_quotas" does not exist`, 0002 was never applied. Paste `supabase/fix_live_database.sql`.

If logging an activity fails with *Could not save this activity to your organisation*,
paste `supabase/fix_entry_save.sql`. The live app calls `log_emission_entry` with
site / tags / activity date; a database that never got migration 0006 does not have
that function signature, so the save was being discarded. This repair adds the
columns, recreates the function, and reloads PostgREST's schema cache.

If inviting people fails with *Could not find the function
public.invite_member(p_email, p_org, p_role) in the schema cache*, paste
`supabase/fix_invite_rpc.sql` into the SQL editor and run it. Deploying the
app does not update Postgres — this repair has to run on the live database.
It drops leftover function overloads, recreates `invite_member`, adds
`invite_org_member`, and reloads PostgREST's schema cache.

To stop tenant users creating extra organisations, also run
`supabase/fix_org_create_owners.sql`. Only `ngonyamasibanda@gmail.com`,
`founders@usecarbonlogic.com` and `founders@carbonlogichq.com` can call
`create_organization` after that.

If you also need existing accounts to be added immediately, run
`supabase/fix_people_access.sql` after that.

It creates organisations, profiles, memberships, invitations and an audit log; replaces
the wide-open `anon` policies on `emission_entries` and `emission_factors` with
membership-scoped ones; and adds `organization_id` / `owner_id` to the emissions tables.

It also drops the old `user_id` column, but only after checking that every row still
says `default_user`. If you have rows with any other value it leaves the column alone
and you should look at why before continuing.

### 2. Create the first account

Start the app, go to `/login`, choose **Create one** and sign up. Confirm the email if
Supabase asks you to. You will land on a "No workspace yet" screen — that is expected.

### 3. Claim your existing data

Back in the SQL editor, uncomment the block at the bottom of the migration file, put
your email and organisation name in it, and run it. That creates the organisation,
makes you the owner, and moves every legacy `default_user` emissions row into it.

After that, refresh the app and everything you had before is there, now owned by you.

### How organisations work

Each company is its own tenant. People you invite join **the organisation you currently
have selected**, not every organisation in the app.

- **A new company** is created only by Carbon Logic owners
  (`ngonyamasibanda@gmail.com`, `founders@usecarbonlogic.com`,
  `founders@carbonlogichq.com`). They name the organisation from the account menu
  or the empty-workspace screen, then invite that company’s people from
  **People & Access**.
- **Everyone else** joins by invitation. Signing up with an invited email lands
  them in that organisation. Tenant owners and managers cannot add further
  organisations — they can only invite people into the one they belong to.
- **Someone already invited** signs up with the same email. They skip the empty
  workspace screen and land in that organisation.

Data never crosses organisations. Switching in the header changes which
workspace you are looking at. Anyone who belongs to more than one organisation
can switch; Carbon Logic owners can switch across every company.

Facilities, baselines, science-based targets, and logged activities (including
site, tags, and activity date) are stored in the organisation database. They are
not kept as files in the browser, so adding staff or logging a year of invoices
does not fill device storage. Evidence should be a SharePoint or Drive link, not
an uploaded file.

## Supabase dashboard settings worth changing

| Setting | Where | Why |
| --- | --- | --- |
| Site URL and redirect URLs | Authentication → URL Configuration | Add your production origin plus `/auth/callback` and `/auth/reset`, otherwise magic links and password resets bounce. |
| Confirm email | Authentication → Providers → Email | If Custom SMTP is not set, turn this **off** or people cannot finish signup — the default mailer often never arrives. Turn it back on after SMTP works. Invites are not emails; they are redeemed when the person signs up with the invited address. |
| SMTP | Project Settings → Auth | Required before confirmation, magic-link, or password-reset emails will reliably arrive. Organisation invites still do not send mail — share the signup link from People & Access. |
| Minimum password length | Authentication → Policies | Set to 12 to match the client-side check. |
| Leaked password protection | Authentication → Policies | Checks new passwords against Have I Been Pwned. Worth turning on. |
| Spend cap | Organization → Billing | Hard stop so a stolen anon key or write flood cannot run up a five-figure invoice. |
| Billing alerts | Organization → Billing → Email notifications | Email before you hit the cap. Some providers have no cap — alerts are the minimum. |

## Enterprise SSO

The login page has a SAML path already wired to `signInWithSSO`. It will tell the user
"single sign-on is not set up for yourdomain.com" until you do two things:

1. Be on a Supabase plan that includes SAML (Pro or above).
2. Register your identity provider, e.g.

   ```
   supabase sso add --project-ref <ref> \
     --type saml \
     --metadata-url 'https://your-idp/app/metadata' \
     --domains yourcompany.com
   ```

Once the domain is registered, anyone typing a `@yourcompany.com` address and choosing
single sign-on is redirected to your IdP. Supabase creates the user on first login, and
the sign-up trigger gives them a profile plus any organisation their address was
invited to.

Note that SAML gives you authentication, not deprovisioning. Removing someone in Okta
stops them getting a new session but does not delete their membership here, so removing
them under **People & Access** is still part of your offboarding.

## How it is put together

### Authorization lives in the database

This is a static single-page app. The anon key is in the JavaScript bundle, so anyone
can read it and call the REST API directly. Everything in `src/components/auth/` is
therefore user experience, not security — the actual rules are the Row Level Security
policies in the migration.

Concretely: `RequireRole` stops a viewer *seeing* the People page, and the policy on
`memberships` stops a viewer *changing* anyone's role even if they call the API by hand.

Membership changes do not go through RLS at all. They go through `SECURITY DEFINER`
functions (`invite_member`, `set_member_role`, `remove_member`) because rules like "you
cannot grant a role above your own" and "an organisation must keep an owner" are much
clearer as procedural code than as policy predicates. Those functions pin
`search_path = ''` and schema-qualify every name, which is what stops the classic
`SECURITY DEFINER` privilege-escalation trick.

The membership lookup helpers are also `SECURITY DEFINER` for a second reason: a policy
on `memberships` that reads `memberships` re-enters itself and Postgres aborts with
"infinite recursion detected in policy".

### Roles

| Role | Can |
| --- | --- |
| viewer | Read dashboards, reports and factors |
| editor | Everything above, plus log and edit emissions data |
| admin | Everything above, plus manage people, factors, targets and read the audit log |
| owner | Everything above, plus organisation settings |

Nobody can grant a role above their own, and the last owner cannot be demoted or
removed.

### Sessions

Tokens are handled by Supabase using PKCE, with rotating refresh tokens and reuse
detection. Sessions are revocable server-side, so signing out genuinely ends the
session rather than just forgetting it locally.

The honest caveat: OWASP and the OAuth working group recommend a backend-for-frontend
for SPAs, so that tokens never reach the browser at all. That needs a server, which
this app does not have. Rotation with reuse detection plus short-lived access tokens is
the strongest position available without one. If you later put an API server in front
of Supabase, moving to a `__Host-` prefixed HttpOnly cookie session is the upgrade path.

Idle and absolute timeouts are per organisation, in `organizations.session_idle_minutes`
(default 30) and `session_absolute_hours` (default 12). OWASP suggests 15–30 minutes
idle for low-risk applications and 4–8 hours absolute; emissions reporting is business
data rather than money movement, so the defaults sit at the permissive end. Lower them
by updating the row.

Activity is shared between tabs, so working in one tab will not let another time you
out, and a warning appears 90 seconds before the cut-off.

### Passwords

Following NIST SP 800-63B: a 12 character minimum, a blocklist of common and
context-specific words, and no forced composition rules or expiry, both of which that
guidance now advises against. Turn on leaked password protection in the dashboard to
add a breach-corpus check.

Sign-in failures never say whether an address exists, and magic-link and reset requests
always report success, so neither form can be used to enumerate accounts.

### Audit log

`audit_log` is append-only: members can insert through `record_audit_event`, admins can
read, and there is no update or delete policy for anyone. Sign-outs, invitations, role
changes, removals and MFA changes are recorded.

## Testing

```
npm run verify:migration
```

Runs the migration against a real Postgres (PGlite, compiled to WASM) layered on a
replica of the pre-migration schema, then exercises the rules as ordinary users: tenant
isolation, role enforcement, privilege escalation attempts, and the legacy data
handover. 92 checks.
