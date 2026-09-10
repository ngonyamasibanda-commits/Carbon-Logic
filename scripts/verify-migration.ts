/**
 * Runs supabase/migrations/0001_auth_and_tenancy.sql against a real Postgres (PGlite,
 * compiled to WASM) on top of a replica of the pre-migration schema, then exercises
 * the access rules as ordinary users.
 *
 * The point is to catch broken SQL and, more importantly, broken isolation before the
 * migration is pointed at production data.
 *
 *   npm run verify:migration
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const db = new PGlite()

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function expectFailure(name: string, run: () => Promise<unknown>, expect?: RegExp) {
  try {
    await run()
    check(name, false, 'expected an error but the statement succeeded')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (expect && !expect.test(message)) {
      check(name, false, `wrong error: ${message}`)
    } else {
      check(name, true)
    }
  }
}

/** Impersonates a signed-in user the way PostgREST does. */
async function asUser<T>(
  userId: string,
  run: () => Promise<T>,
  headers: Record<string, string> = {},
): Promise<T> {
  const headerJson = JSON.stringify(headers).replace(/\\/g, '\\\\').replace(/'/g, "''")
  // Session-scoped rather than `set local`, because each statement here autocommits.
  await db.exec(`
    set role authenticated;
    set request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}';
    set request.headers = '${headerJson}';
  `)
  try {
    return await run()
  } finally {
    await db.exec("reset role; set request.jwt.claims = ''; set request.headers = '';")
  }
}

async function countOf(sql: string, params: unknown[] = []): Promise<number> {
  const result = await db.query<{ count: string | number }>(sql, params)
  return Number(result.rows[0].count)
}

async function main() {
  console.log('\nSetting up a Supabase-shaped database\n')

  // Supabase's built-in roles and the slice of the auth schema our SQL touches.
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema if not exists auth;

    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique not null,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );

    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(
        nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub',
        ''
      )::uuid
    $$;
  `)

  // The schema exactly as it exists today, including the legacy rows.
  await db.exec(readFileSync(join(root, 'supabase_schema.sql'), 'utf8'))
  await db.exec(`
    insert into emission_entries (category, scope, emissions_tco2e, details)
    values ('bulk_materials', 'Scope 3', 12.5, 'legacy row one'),
           ('fuels', 'Scope 1', 3.25, 'legacy row two');
  `)
  console.log(
    `  Seeded ${await countOf('select count(*) from emission_entries')} legacy entries under default_user`,
  )

  console.log('\nApplying the migration\n')
  const migration = readFileSync(join(root, 'supabase/migrations/0001_auth_and_tenancy.sql'), 'utf8')
  await db.exec(migration)
  check('migration applies cleanly', true)

  await db.exec(migration)
  check('migration is idempotent (second run is clean)', true)

  await db.exec(`
    grant usage on schema public to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant usage, select on all sequences in schema public to authenticated;
  `)

  const quotas = readFileSync(join(root, 'supabase/migrations/0002_quotas_and_hardening.sql'), 'utf8')
  await db.exec(quotas)
  check('quota migration applies cleanly', true)
  await db.exec(quotas)
  check('quota migration is idempotent (second run is clean)', true)

  const ipLimits = readFileSync(join(root, 'supabase/migrations/0003_ip_rate_limits.sql'), 'utf8')
  await db.exec(ipLimits)
  check('IP rate-limit migration applies cleanly', true)
  await db.exec(ipLimits)
  check('IP rate-limit migration is idempotent (second run is clean)', true)

  const platformOwners = readFileSync(join(root, 'supabase/migrations/0004_platform_owner_access.sql'), 'utf8')
  await db.exec(platformOwners)
  check('platform-owner access migration applies cleanly', true)
  await db.exec(platformOwners)
  check('platform-owner access migration is idempotent (second run is clean)', true)

  const orgEntries = readFileSync(join(root, 'supabase/migrations/0005_org_scoped_entries.sql'), 'utf8')
  await db.exec(orgEntries)
  check('organisation-scoped entries migration applies cleanly', true)
  await db.exec(orgEntries)
  check('organisation-scoped entries migration is idempotent (second run is clean)', true)

  await db.exec(readFileSync(join(root, 'supabase/fix_entry_save.sql'), 'utf8'))
  check('entry-save repair script applies cleanly', true)

  const saasWorkspace = readFileSync(join(root, 'supabase/migrations/0006_saas_cloud_workspace.sql'), 'utf8')
  await db.exec(saasWorkspace)
  check('SaaS cloud workspace migration applies cleanly', true)
  await db.exec(saasWorkspace)
  check('SaaS cloud workspace migration is idempotent (second run is clean)', true)

  console.log('\nProvisioning users\n')
  const users = await db.query<{ id: string; email: string }>(`
    insert into auth.users (email, raw_user_meta_data) values
      ('ngonyamasibanda@gmail.com', '{"full_name":"Founder"}'),
      ('founders@usecarbonlogic.com', '{"full_name":"Founders Use"}'),
      ('founders@carbonlogichq.com', '{"full_name":"Founders HQ"}'),
      ('owner@acme.test', '{"full_name":"Olive Owner"}'),
      ('editor@acme.test', '{"full_name":"Eddie Editor"}'),
      ('viewer@acme.test', '{"full_name":"Vera Viewer"}'),
      ('rival@other.test', '{"full_name":"Rita Rival"}')
    returning id, email
  `)
  const id = Object.fromEntries(users.rows.map((row) => [row.email, row.id])) as Record<string, string>

  const profileCount = await countOf('select count(*) from public.profiles')
  check(
    'sign-up trigger created a profile for every user',
    profileCount === 7,
    `got ${profileCount}`,
  )

  console.log('\nOrganizations and membership\n')

  async function provisionOrg(name: string, ownerEmail: string): Promise<string> {
    const orgId = await asUser(id['ngonyamasibanda@gmail.com'], async () => {
      const result = await db.query<{ create_organization: string }>(
        'select public.create_organization($1)',
        [name],
      )
      return result.rows[0].create_organization
    })
    await asUser(id['ngonyamasibanda@gmail.com'], async () => {
      await db.query('select public.invite_member($1, $2, $3)', [orgId, ownerEmail, 'owner'])
    })
    const founderMembership = await db.query<{ id: string }>(
      'select id from public.memberships where organization_id = $1 and user_id = $2',
      [orgId, id['ngonyamasibanda@gmail.com']],
    )
    await asUser(id['ngonyamasibanda@gmail.com'], async () => {
      await db.query('select public.remove_member($1)', [founderMembership.rows[0].id])
    })
    return orgId
  }

  const acme = await provisionOrg('Acme Construction', 'owner@acme.test')
  check('a platform owner can create an organization', Boolean(acme))

  const ownerRole = await db.query<{ role: string }>(
    'select role from public.memberships where organization_id = $1 and user_id = $2',
    [acme, id['owner@acme.test']],
  )
  check('creator becomes owner', ownerRole.rows[0]?.role === 'owner')

  const rivalOrg = await provisionOrg('Rival Ltd', 'rival@other.test')

  await asUser(id['owner@acme.test'], () =>
    expectFailure(
      'a tenant owner cannot create another organisation',
      () => db.query("select public.create_organization('Shadow Ltd')"),
      /Only Carbon Logic owners/,
    ),
  )

  await asUser(id['founders@usecarbonlogic.com'], async () => {
    const extra = await db.query<{ create_organization: string }>(
      "select public.create_organization('Logic Extra')",
    )
    check('another platform owner can create an organisation', Boolean(extra.rows[0]?.create_organization))
  })

  await asUser(id['owner@acme.test'], async () => {
    await db.query('select public.invite_member($1, $2, $3)', [acme, 'editor@acme.test', 'editor'])
  })
  const immediate = await db.query<{ role: string }>(
    'select role from public.memberships where organization_id = $1 and user_id = $2',
    [acme, id['editor@acme.test']],
  )
  check(
    'inviting an existing account grants access immediately',
    immediate.rows[0]?.role === 'editor',
  )

  await asUser(id['owner@acme.test'], async () => {
    await db.query('select public.invite_member($1, $2, $3)', [acme, 'newhire@acme.test', 'viewer'])
  })
  const pending = await db.query<{ email: string }>(
    "select email from public.invitations where organization_id = $1 and accepted_at is null and email = 'newhire@acme.test'",
    [acme],
  )
  check('unknown addresses get a pending invitation', pending.rows.length === 1)

  const hired = await db.query<{ id: string }>(`
    insert into auth.users (email) values ('newhire@acme.test') returning id
  `)
  id['newhire@acme.test'] = hired.rows[0].id

  await asUser(id['owner@acme.test'], async () => {
    await db.query('select public.invite_member($1, $2, $3)', [acme, 'viewer@acme.test', 'viewer'])
  })

  const redeemed = await db.query<{ role: string; user_id: string }>(
    'select role, user_id from public.memberships where organization_id = $1 order by role',
    [acme],
  )
  check(
    'invitations are redeemed automatically on sign-up',
    redeemed.rows.some((r) => r.user_id === hired.rows[0].id && r.role === 'viewer'),
  )
  check(
    'invited users get exactly the role they were offered',
    redeemed.rows.some((r) => r.user_id === id['editor@acme.test'] && r.role === 'editor') &&
      redeemed.rows.some((r) => r.user_id === id['viewer@acme.test'] && r.role === 'viewer'),
  )

  console.log('\nPrivilege escalation\n')

  const editorMembership = await db.query<{ id: string }>(
    'select id from public.memberships where organization_id = $1 and user_id = $2',
    [acme, id['editor@acme.test']],
  )
  const ownerMembership = await db.query<{ id: string }>(
    'select id from public.memberships where organization_id = $1 and user_id = $2',
    [acme, id['owner@acme.test']],
  )

  await asUser(id['editor@acme.test'], () =>
    expectFailure(
      'an editor cannot promote themselves',
      () =>
        db.query('select public.set_member_role($1, $2)', [
          editorMembership.rows[0].id,
          'owner',
        ]),
      /Only admins and owners/,
    ),
  )

  await asUser(id['owner@acme.test'], async () => {
    await db.query('select public.set_member_role($1, $2)', [editorMembership.rows[0].id, 'admin'])
  })
  await asUser(id['editor@acme.test'], () =>
    expectFailure(
      'an admin cannot grant a role above their own',
      () => db.query('select public.invite_member($1, $2, $3)', [acme, 'x@acme.test', 'owner']),
      /higher than your own/,
    ),
  )
  await asUser(id['editor@acme.test'], () =>
    expectFailure(
      'an admin cannot demote the owner',
      () =>
        db.query('select public.set_member_role($1, $2)', [ownerMembership.rows[0].id, 'viewer']),
      /above you/,
    ),
  )
  await asUser(id['owner@acme.test'], () =>
    expectFailure(
      'the last owner cannot be removed',
      () => db.query('select public.remove_member($1)', [ownerMembership.rows[0].id]),
      /at least one owner/,
    ),
  )
  await asUser(id['rival@other.test'], () =>
    expectFailure(
      'an outsider cannot invite themselves into another organization',
      () => db.query('select public.invite_member($1, $2, $3)', [acme, 'rival@other.test', 'admin']),
      /Only admins and owners/,
    ),
  )

  await asUser(id['founders@carbonlogichq.com'], async () => {
    const visible = await db.query<{ id: string }>(
      'select id from public.organizations where id = $1',
      [acme],
    )
    check('a platform owner can view an organisation they do not belong to', visible.rows.length === 1)
    await db.query('select public.invite_member($1, $2, $3)', [acme, 'viewer@acme.test', 'viewer'])
  })
  const platformInvite = await db.query<{ role: string }>(
    'select role from public.memberships where organization_id = $1 and user_id = $2',
    [acme, id['viewer@acme.test']],
  )
  check(
    'a platform owner can invite people into an organisation they do not belong to',
    platformInvite.rows[0]?.role === 'viewer',
  )

  const disposable = await asUser(id['ngonyamasibanda@gmail.com'], async () => {
    const created = await db.query<{ create_organization: string }>(
      "select public.create_organization('Disposable Ltd')",
    )
    return created.rows[0].create_organization
  })
  await asUser(id['owner@acme.test'], () =>
    expectFailure(
      'a tenant owner cannot delete an organisation',
      () => db.query('select public.delete_organization($1)', [disposable]),
      /Only Carbon Logic owners/,
    ),
  )
  await asUser(id['ngonyamasibanda@gmail.com'], async () => {
    await db.query('select public.delete_organization($1)', [disposable])
  })
  const gone = await db.query<{ id: string }>('select id from public.organizations where id = $1', [disposable])
  check('a platform owner can delete an organisation', gone.rows.length === 0)

  console.log('\nClaiming the legacy data\n')

  await db.query(
    `update public.emission_entries
     set organization_id = $1, owner_id = $2
     where organization_id is null`,
    [acme, id['owner@acme.test']],
  )
  const claimed = await countOf(
    'select count(*) from public.emission_entries where organization_id = $1',
    [acme],
  )
  check('legacy default_user rows can be handed to the new organization', claimed === 2)

  const legacyColumn = await countOf(`
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'emission_entries' and column_name = 'user_id'
  `)
  check('the default_user column is gone', legacyColumn === 0)

  console.log('\nTenant isolation and role enforcement\n')

  await asUser(id['owner@acme.test'], async () => {
    const rows = await db.query('select * from public.emission_entries')
    check('a member sees their own organization data', rows.rows.length === 2)
  })

  await asUser(id['rival@other.test'], async () => {
    const rows = await db.query('select * from public.emission_entries')
    check('another tenant sees none of it', rows.rows.length === 0)

    const orgs = await db.query<{ name: string }>('select name from public.organizations')
    check(
      'another tenant cannot even see the organization exists',
      orgs.rows.length === 1 && orgs.rows[0].name === 'Rival Ltd',
    )
  })

  await asUser(id['viewer@acme.test'], async () => {
    const rows = await db.query('select * from public.emission_entries')
    check('a viewer can read', rows.rows.length === 2)
  })

  await asUser(id['viewer@acme.test'], () =>
    expectFailure(
      'a viewer cannot insert emissions data',
      () =>
        db.query(
          `insert into public.emission_entries
             (organization_id, owner_id, category, scope, emissions_tco2e)
           values ($1, $2, 'fuels', 'Scope 1', 1)`,
          [acme, id['viewer@acme.test']],
        ),
      /row-level security/i,
    ),
  )

  await asUser(id['viewer@acme.test'], async () => {
    const result = await db.query('delete from public.emission_entries returning id')
    check('a viewer cannot delete emissions data', result.rows.length === 0)
  })

  await asUser(id['viewer@acme.test'], async () => {
    const result = await db.query(
      'update public.emission_entries set emissions_tco2e = 0 returning id',
    )
    check('a viewer cannot edit emissions data', result.rows.length === 0)
  })

  await asUser(id['rival@other.test'], async () => {
    const result = await db.query(
      'update public.emission_entries set emissions_tco2e = 0 returning id',
    )
    check('another tenant cannot edit data they cannot see', result.rows.length === 0)
  })

  await asUser(id['editor@acme.test'], async () => {
    await db.query(
      `insert into public.emission_entries
         (organization_id, owner_id, category, scope, emissions_tco2e)
       values ($1, $2, 'fuels', 'Scope 1', 4.2)`,
      [acme, id['editor@acme.test']],
    )
    check('an editor can insert', true)
  })

  await asUser(id['editor@acme.test'], () =>
    expectFailure(
      'nobody can write a row into a different organization',
      () =>
        db.query(
          `insert into public.emission_entries
             (organization_id, owner_id, category, scope, emissions_tco2e)
           values ($1, $2, 'fuels', 'Scope 1', 9)`,
          [rivalOrg, id['editor@acme.test']],
        ),
      /row-level security|not a member/i,
    ),
  )

  await asUser(id['editor@acme.test'], () =>
    expectFailure(
      'an entry cannot be filed under someone else',
      () =>
        db.query(
          `insert into public.emission_entries
             (organization_id, owner_id, category, scope, emissions_tco2e)
           values ($1, $2, 'fuels', 'Scope 1', 9)`,
          [acme, id['owner@acme.test']],
        ),
      /row-level security/i,
    ),
  )

  function listedRows(value: unknown): Array<Record<string, unknown>> {
    if (typeof value === 'string') return JSON.parse(value) as Array<Record<string, unknown>>
    if (Array.isArray(value)) return value as Array<Record<string, unknown>>
    return []
  }

  await asUser(id['editor@acme.test'], async () => {
    const listed = await db.query<{ list_emission_entries: unknown }>(
      'select public.list_emission_entries($1)',
      [acme],
    )
    const rows = listedRows(listed.rows[0].list_emission_entries)
    check(
      'an editor lists every organisation entry, not only their own',
      rows.length >= 3,
      `got ${rows.length}`,
    )
  })

  const logged = await asUser(id['owner@acme.test'], async () => {
    const result = await db.query<{ log_emission_entry: Record<string, unknown> }>(
      `select public.log_emission_entry($1, 'fuels', 'Scope 1', 1.5, 'shared org row')`,
      [acme],
    )
    return result.rows[0].log_emission_entry
  })
  check(
    'logging an entry stores it on the organisation',
    String(logged.organization_id) === acme,
    `got ${JSON.stringify(logged)}`,
  )

  await asUser(id['editor@acme.test'], async () => {
    const listed = await db.query<{ list_emission_entries: unknown }>(
      'select public.list_emission_entries($1)',
      [acme],
    )
    const rows = listedRows(listed.rows[0].list_emission_entries)
    check(
      'a second account in the same organisation sees the first account’s entries',
      rows.some((row) => row.details === 'shared org row'),
    )
  })

  await expectFailure(
    'another tenant cannot list this organisation’s entries by id',
    () =>
      asUser(id['rival@other.test'], () => db.query('select public.list_emission_entries($1)', [acme])),
    /not a member/i,
  )

  await asUser(id['viewer@acme.test'], () =>
    expectFailure(
      'a viewer cannot log an entry through the RPC',
      () =>
        db.query(`select public.log_emission_entry($1, 'fuels', 'Scope 1', 1, 'viewer row')`, [acme]),
      /not a member|row-level security/i,
    ),
  )

  await asUser(id['editor@acme.test'], async () => {
    await db.query(
      `insert into public.sites (organization_id, name, type, region)
       values ($1, 'Pit A', 'mine', 'United Kingdom')`,
      [acme],
    )
    check('an editor can add a facility for the organisation', true)
  })

  await asUser(id['viewer@acme.test'], async () => {
    const rows = await db.query<{ name: string }>('select name from public.sites')
    check('a colleague sees the same facilities', rows.rows.some((row) => row.name === 'Pit A'))
  })

  await asUser(id['rival@other.test'], async () => {
    const rows = await db.query('select * from public.sites')
    check('another tenant cannot see those facilities', rows.rows.length === 0)
  })

  await asUser(id['owner@acme.test'], async () => {
    const listed = await db.query<{ list_org_members: unknown }>('select public.list_org_members($1)', [acme])
    const people = listedRows(listed.rows[0].list_org_members)
    check(
      'list_org_members returns people in this organisation',
      people.length >= 3,
      `got ${people.length}`,
    )
  })

  const lateJoiner = await db.query<{ id: string }>(`
    insert into auth.users (email) values ('latejoin@acme.test') returning id
  `)
  await db.query(
    `insert into public.invitations (organization_id, email, role, expires_at)
     values ($1, 'latejoin@acme.test', 'editor', now() + interval '30 days')`,
    [acme],
  )
  await asUser(lateJoiner.rows[0].id, async () => {
    await db.query('select public.redeem_my_invitations()')
  })
  const redeemedLater = await countOf(
    'select count(*) from public.memberships where organization_id = $1 and user_id = $2',
    [acme, lateJoiner.rows[0].id],
  )
  check('signing in redeems a pending invitation for an existing account', redeemedLater === 1)

  const profileFk = await countOf(`
    select count(*) from pg_constraint
    where conname = 'memberships_user_id_profiles_fkey'
  `)
  check('memberships reference profiles so People & Access can list colleagues', profileFk === 1)

  await asUser(id['editor@acme.test'], async () => {
    const logged = await db.query<{ log_emission_entry: Record<string, unknown> }>(
      `select public.log_emission_entry($1, 'site_fuel', 'Scope 1', 2.2, 'diesel', 100, 'L', '', '', 'Pit A', array['ytd'], '[]'::jsonb, '2025-03-01')`,
      [acme],
    )
    const row = logged.rows[0].log_emission_entry
    check(
      'logged activities keep the site and activity date on the organisation',
      row.site === 'Pit A' && String(row.activity_date).includes('2025-03-01'),
      `got ${JSON.stringify(row)}`,
    )
  })

  console.log('\nFactors, audit log and profiles\n')

  await asUser(id['viewer@acme.test'], async () => {
    const shared = await db.query('select * from public.emission_factors')
    check('the shared factor catalogue is readable by everyone', shared.rows.length === 4)
  })

  // RLS filters rows on UPDATE rather than raising, so the tell is zero rows affected.
  await asUser(id['viewer@acme.test'], async () => {
    const result = await db.query('update public.emission_factors set co2e_factor = 999 returning id')
    check('nobody can overwrite the shared factor catalogue', result.rows.length === 0)
  })

  await asUser(id['viewer@acme.test'], () =>
    expectFailure(
      'a viewer cannot add an organization factor',
      () =>
        db.query(
          `insert into public.emission_factors (activity_type, co2e_factor, unit, organization_id)
           values ('sneaky_factor', 0.1, 'kWh', $1)`,
          [acme],
        ),
      /row-level security/i,
    ),
  )

  // This user was promoted to admin earlier in the run.
  await asUser(id['editor@acme.test'], async () => {
    await db.query(
      `insert into public.emission_factors (activity_type, co2e_factor, unit, organization_id)
       values ('electricity_grid_kwh', 0.111, 'kWh', $1)`,
      [acme],
    )
    check('an admin can override a factor that exists in the shared catalogue', true)
  })

  await asUser(id['rival@other.test'], async () => {
    const rows = await db.query<{ organization_id: string | null }>(
      'select organization_id from public.emission_factors',
    )
    check(
      'one tenant cannot see another tenant factor override',
      rows.rows.every((row) => row.organization_id === null),
    )
  })

  await asUser(id['editor@acme.test'], async () => {
    await db.query('select public.record_audit_event($1, $2)', [acme, 'test.event'])
    const rows = await db.query('select * from public.audit_log')
    check('an admin can read the audit log', rows.rows.length > 0)
  })

  await asUser(id['viewer@acme.test'], async () => {
    const rows = await db.query('select * from public.audit_log')
    check('a viewer cannot read the audit log', rows.rows.length === 0)
  })

  await asUser(id['viewer@acme.test'], async () => {
    const result = await db.query('delete from public.audit_log returning id')
    check('the audit log cannot be deleted', result.rows.length === 0)
  })

  await asUser(id['viewer@acme.test'], async () => {
    const rows = await db.query<{ email: string }>('select email from public.profiles')
    const emails = rows.rows.map((r) => r.email).sort()
    check(
      'a member sees colleague profiles but not strangers',
      emails.length === 5 && !emails.includes('rival@other.test'),
      emails.join(', '),
    )
  })

  await asUser(id['rival@other.test'], async () => {
    const result = await db.query(
      'update public.profiles set full_name = $1 where email = $2 returning id',
      ['Hacked', 'owner@acme.test'],
    )
    check('nobody can edit another user profile', result.rows.length === 0)
  })

  console.log('\nRow Level Security configuration\n')

  const coverage = await db.query<{
    table_name: string
    rls_enabled: boolean
    rls_forced: boolean
    policy_count: string | number
  }>(`
    select
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced,
      count(p.polname) as policy_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policy p on p.polrelid = c.oid
    where n.nspname = 'public' and c.relkind = 'r'
    group by c.relname, c.relrowsecurity, c.relforcerowsecurity
    order by c.relname
  `)
  const uncovered = coverage.rows.filter(
    (row) => !row.rls_enabled || !row.rls_forced || Number(row.policy_count) === 0,
  )
  check(
    'every public table has RLS forced on and at least one policy',
    uncovered.length === 0,
    uncovered.map((row) => row.table_name).join(', '),
  )

  const openPolicies = await db.query<{ policyname: string; tablename: string }>(`
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (qual = 'true' or with_check = 'true' or 'anon' = any (roles))
  `)
  check(
    'no USING (true) or anon-targeted policies remain',
    openPolicies.rows.length === 0,
    openPolicies.rows.map((row) => `${row.tablename}:${row.policyname}`).join(', '),
  )

  await db.exec('grant usage on schema public to anon')
  await expectFailure(
    'anon has no table grant on emission_entries',
    async () => {
      await db.exec('set role anon')
      try {
        await db.query('select * from public.emission_entries')
      } finally {
        await db.exec('reset role')
      }
    },
    /permission denied/i,
  )

  // Recreate the original misconfiguration, then prove the repair script closes it.
  await db.exec(`
    grant select, insert, delete on public.emission_entries to anon;
    create policy "Allow anon read emission_entries"
      on public.emission_entries for select to anon using (true);
    create policy "Allow anon insert emission_entries"
      on public.emission_entries for insert to anon with check (true);
  `)
  await db.exec('set role anon')
  const leaked = await db.query('select * from public.emission_entries')
  await db.exec('reset role')
  check(
    'the legacy anon USING (true) policy would expose every row',
    leaked.rows.length > 0,
  )

  await db.exec(readFileSync(join(root, 'supabase/fix_rls.sql'), 'utf8'))
  check('RLS repair script applies cleanly', true)

  await db.exec('grant select, insert on public.emission_entries to anon')
  await db.exec('set role anon')
  const afterRepair = await db.query('select * from public.emission_entries')
  await db.exec('reset role')
  check(
    'after repair, anon cannot read entries even with a table grant',
    afterRepair.rows.length === 0,
  )

  await expectFailure(
    'after repair, anon cannot insert entries',
    async () => {
      await db.exec('set role anon')
      try {
        await db.query(
          `insert into public.emission_entries (category, scope, emissions_tco2e)
           values ('fuels', 'Scope 1', 1)`,
        )
      } finally {
        await db.exec('reset role')
      }
    },
    /row-level security|permission denied/i,
  )

  await asUser(id['owner@acme.test'], async () => {
    const rows = await db.query('select * from public.emission_entries')
    check('repair does not lock out signed-in members', rows.rows.length >= 2)
  })

  await db.exec(readFileSync(join(root, 'supabase_schema.sql'), 'utf8'))
  const reopened = await db.query<{ policyname: string }>(`
    select policyname from pg_policies
    where schemaname = 'public'
      and (qual = 'true' or with_check = 'true' or 'anon' = any (roles))
  `)
  check(
    're-running supabase_schema.sql does not reopen anon access',
    reopened.rows.length === 0,
    reopened.rows.map((row) => row.policyname).join(', '),
  )

  console.log('\nQuotas, column grants, and cross-organisation isolation\n')

  const billingOnProfiles = await db.query<{ column_name: string }>(`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name in (
        'plan', 'subscription', 'subscription_status', 'is_premium',
        'rate_limit', 'rate_limits', 'quota', 'entries_per_hour'
      )
  `)
  check(
    'profiles does not store plan, subscription, or rate limits',
    billingOnProfiles.rows.length === 0,
    billingOnProfiles.rows.map((row) => row.column_name).join(', '),
  )

  const acmeQuota = await countOf(
    'select count(*) from public.org_quotas where organization_id = $1',
    [acme],
  )
  check('creating an organisation seeds a quota row', acmeQuota === 1)

  await asUser(id['owner@acme.test'], async () => {
    const rows = await db.query<{ plan: string; entries_per_hour: number }>(
      'select plan, entries_per_hour from public.org_quotas',
    )
    check(
      'a member can read their own organisation quota',
      rows.rows.length === 1 && rows.rows[0].plan === 'free',
    )
  })

  await asUser(id['rival@other.test'], async () => {
    const quotas = await db.query(
      'select * from public.org_quotas where organization_id = $1',
      [acme],
    )
    check('another tenant cannot read this organisation quota', quotas.rows.length === 0)

    const usage = await db.query(
      'select * from public.usage_windows where organization_id = $1',
      [acme],
    )
    check('another tenant cannot read this organisation usage', usage.rows.length === 0)

    const entries = await db.query(
      'select * from public.emission_entries where organization_id = $1',
      [acme],
    )
    check(
      'another tenant cannot read this organisation entries even when they ask by id',
      entries.rows.length === 0,
    )
  })

  await expectFailure(
    'a member cannot raise their own quota',
    () =>
      asUser(id['owner@acme.test'], () =>
        db.query('update public.org_quotas set entries_per_hour = 999999 returning organization_id'),
      ),
    /permission denied|row-level security/i,
  )

  await expectFailure(
    'a member cannot insert a quota row',
    () =>
      asUser(id['owner@acme.test'], () =>
        db.query('insert into public.org_quotas (organization_id, entries_per_hour) values ($1, 999999)', [
          acme,
        ]),
      ),
    /permission denied|row-level security|duplicate/i,
  )

  await expectFailure(
    'a member cannot decrement their usage counter',
    () =>
      asUser(id['owner@acme.test'], () =>
        db.query('update public.usage_windows set count = 0 returning organization_id'),
      ),
    /permission denied|row-level security/i,
  )

  await expectFailure(
    'clients cannot call consume_org_quota',
    () =>
      asUser(id['owner@acme.test'], () =>
        db.query('select public.consume_org_quota($1, $2)', [acme, 'entry_write']),
      ),
    /permission denied/i,
  )

  await expectFailure(
    'a user cannot change their profile email',
    () =>
      asUser(id['owner@acme.test'], () =>
        db.query("update public.profiles set email = 'stolen@acme.test' returning id"),
      ),
    /permission denied|cannot be changed/i,
  )

  await expectFailure(
    'invitations cannot be inserted except through the RPC',
    () =>
      asUser(id['owner@acme.test'], () =>
        db.query(
          `insert into public.invitations (organization_id, email, role)
           values ($1, 'bypass@acme.test', 'admin')`,
          [acme],
        ),
      ),
    /row-level security|permission denied/i,
  )

  await db.query('update public.org_quotas set entries_per_hour = 0 where organization_id = $1', [
    acme,
  ])
  await asUser(id['editor@acme.test'], () =>
    expectFailure(
      'an editor is stopped once the organisation hourly entry quota is reached',
      () =>
        db.query(
          `insert into public.emission_entries
             (organization_id, owner_id, category, scope, emissions_tco2e)
           values ($1, $2, 'fuels', 'Scope 1', 1)`,
          [acme, id['editor@acme.test']],
        ),
      /rate limit/i,
    ),
  )

  await db.exec(readFileSync(join(root, 'supabase/fix_quotas.sql'), 'utf8'))
  check('quota repair script applies cleanly', true)

  await db.query(
    'update public.org_quotas set entries_per_hour = 50000 where organization_id = $1',
    [acme],
  )

  await db.query(`
    insert into public.ip_usage_windows (ip_hash, action, window_start, count)
    values (
      md5('203.0.113.9'),
      'write_minute',
      date_bin('1 minute', now(), timestamptz '2000-01-01+00'),
      400
    )
    on conflict (ip_hash, action, window_start) do update set count = 400
  `)
  await asUser(
    id['editor@acme.test'],
    () =>
      expectFailure(
        'the same IP is stopped even if the organisation still has quota',
        () =>
          db.query(
            `insert into public.emission_entries
               (organization_id, owner_id, category, scope, emissions_tco2e)
             values ($1, $2, 'fuels', 'Scope 1', 1)`,
            [acme, id['editor@acme.test']],
          ),
        /rate limit/i,
      ),
    { 'cf-connecting-ip': '203.0.113.9' },
  )

  await asUser(id['editor@acme.test'], async () => {
    const rows = await db.query('select * from public.ip_usage_windows')
    check('clients cannot read IP usage buckets', rows.rows.length === 0)
  })

  console.log(`\n${passed} passed, ${failed} failed\n`)
  await db.close()
  if (failed > 0) process.exit(1)
}

main().catch((error) => {
  console.error('\nVerification crashed:\n', error)
  process.exit(1)
})
