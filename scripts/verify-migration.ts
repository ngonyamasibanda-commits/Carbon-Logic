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
async function asUser<T>(userId: string, run: () => Promise<T>): Promise<T> {
  // Session-scoped rather than `set local`, because each statement here autocommits.
  await db.exec(`
    set role authenticated;
    set request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}';
  `)
  try {
    return await run()
  } finally {
    await db.exec("reset role; set request.jwt.claims = '';")
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

  console.log('\nProvisioning users\n')
  const users = await db.query<{ id: string; email: string }>(`
    insert into auth.users (email, raw_user_meta_data) values
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
    profileCount === 4,
    `got ${profileCount}`,
  )

  console.log('\nOrganizations and membership\n')

  const acme = await asUser(id['owner@acme.test'], async () => {
    const result = await db.query<{ create_organization: string }>(
      "select public.create_organization('Acme Construction')",
    )
    return result.rows[0].create_organization
  })
  check('a signed-in user can create an organization', Boolean(acme))

  const ownerRole = await db.query<{ role: string }>(
    'select role from public.memberships where organization_id = $1 and user_id = $2',
    [acme, id['owner@acme.test']],
  )
  check('creator becomes owner', ownerRole.rows[0]?.role === 'owner')

  const rivalOrg = await asUser(id['rival@other.test'], async () => {
    const result = await db.query<{ create_organization: string }>(
      "select public.create_organization('Rival Ltd')",
    )
    return result.rows[0].create_organization
  })

  await asUser(id['owner@acme.test'], async () => {
    await db.query('select public.invite_member($1, $2, $3)', [acme, 'editor@acme.test', 'editor'])
    await db.query('select public.invite_member($1, $2, $3)', [acme, 'viewer@acme.test', 'viewer'])
  })

  // Invitations are redeemed on sign-up, so re-create the invited users to simulate it.
  await db.exec("delete from auth.users where email in ('editor@acme.test','viewer@acme.test')")
  const reinvited = await db.query<{ id: string; email: string }>(`
    insert into auth.users (email) values ('editor@acme.test'), ('viewer@acme.test')
    returning id, email
  `)
  for (const row of reinvited.rows) id[row.email] = row.id

  const redeemed = await db.query<{ role: string; user_id: string }>(
    'select role, user_id from public.memberships where organization_id = $1 order by role',
    [acme],
  )
  check(
    'invitations are redeemed automatically on sign-up',
    redeemed.rows.length === 3,
    `got ${redeemed.rows.length} memberships`,
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
      /row-level security/i,
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
      emails.length === 3 && !emails.includes('rival@other.test'),
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

  console.log(`\n${passed} passed, ${failed} failed\n`)
  await db.close()
  if (failed > 0) process.exit(1)
}

main().catch((error) => {
  console.error('\nVerification crashed:\n', error)
  process.exit(1)
})
