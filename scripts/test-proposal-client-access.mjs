// Testa a migração SQL real em PostgreSQL local em memória, sem acessar produção.
// Requer @electric-sql/pglite instalado ou PGLITE_TEST_MODULE apontando para seu
// dist/index.js. Executar: node --test scripts/test-proposal-client-access.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(process.env.PGLITE_TEST_MODULE
    ? pathToFileURL(process.env.PGLITE_TEST_MODULE).href
    : '@electric-sql/pglite');
const migration = await readFile(new URL(
    '../supabase/migrations/20260831210000_fix_shared_proposal_client_access.sql',
    import.meta.url
), 'utf8');
const previousMigration = await readFile(new URL(
    '../supabase/migrations/20260815220000_proposal_snapshot_integrity.sql',
    import.meta.url
), 'utf8');
const previousFunction = previousMigration.match(
    /CREATE OR REPLACE FUNCTION public\.can_access_proposal_client\(target_client_id bigint\)[\s\S]*?\$\$;/
)?.[0];
assert.ok(previousFunction, 'A regra anterior precisa estar disponível para a regressão');

const uuid = number => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const people = {
    ownerA: uuid(1), memberA: uuid(2), colleagueA: uuid(3),
    pendingA: uuid(4), blockedA: uuid(5), unlinkedA: uuid(6),
    ownerB: uuid(7), memberB: uuid(8), movedB: uuid(9), standalone: uuid(10),
};
const orgA = uuid(101);
const orgB = uuid(102);

test('autorização compartilhada preserva dados e isolamento entre empresas', async t => {
    const db = new PGlite();
    try {
        await db.exec(`
            CREATE SCHEMA auth;
            CREATE ROLE authenticated;
            CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
                'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
            CREATE TABLE public.profiles (id uuid PRIMARY KEY, organization_id uuid);
            CREATE TABLE public.organizations (id uuid PRIMARY KEY, owner_id uuid);
            CREATE TABLE public.organization_members (organization_id uuid, user_id uuid, status text);
            CREATE TABLE public.clients (id bigint PRIMARY KEY, user_id uuid, organization_id uuid);
            CREATE TABLE public.proposal_option_states (client_id bigint PRIMARY KEY, organization_id uuid, snapshot jsonb);
        `);
        for (const [name, id] of Object.entries(people)) {
            const org = name === 'standalone' ? null : name.endsWith('B') ? orgB : orgA;
            await db.query('INSERT INTO public.profiles VALUES ($1, $2)', [id, org]);
        }
        await db.query('INSERT INTO public.organizations VALUES ($1, $2), ($3, $4)', [orgA, people.ownerA, orgB, people.ownerB]);
        for (const [name, status] of Object.entries({ memberA: 'active', colleagueA: 'active', pendingA: 'pending', blockedA: 'blocked', memberB: 'active', movedB: 'active' })) {
            await db.query('INSERT INTO public.organization_members VALUES ($1, $2, $3)', [name.endsWith('B') ? orgB : orgA, people[name], status]);
        }
        const clients = [
            [1, people.memberA, null], [2, people.colleagueA, null],
            [3, people.ownerA, null], [4, people.memberA, orgA],
            [5, people.memberB, null], [6, people.memberB, orgB],
            [7, people.memberA, null], [8, people.movedB, null],
            [9, people.memberA, orgB], [10, people.standalone, null],
        ];
        for (const row of clients) await db.query('INSERT INTO public.clients VALUES ($1, $2, $3)', row);
        for (const [clientId, org] of [[1, orgA], [2, orgA], [3, orgA], [5, orgB], [8, orgA]]) {
            await db.query('INSERT INTO public.proposal_option_states VALUES ($1, $2, $3)', [clientId, org, JSON.stringify([{ id: 1, name: 'Opção preservada', measurements: [{ id: 11, largura: '1,20', altura: '1,00' }] }])]);
        }
        const access = async (user, clientId) => {
            await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
            const result = await db.query('SELECT public.can_access_proposal_client($1) AS allowed', [clientId]);
            return result.rows[0].allowed;
        };
        const businessData = async () => ({
            clients: (await db.query('SELECT * FROM public.clients ORDER BY id')).rows,
            states: (await db.query('SELECT * FROM public.proposal_option_states ORDER BY client_id')).rows,
            profiles: (await db.query('SELECT * FROM public.profiles ORDER BY id')).rows,
            memberships: (await db.query('SELECT * FROM public.organization_members ORDER BY user_id')).rows,
        });

        await db.exec(previousFunction);
        await t.test('reproduz o bloqueio entre colegas na regra anterior', async () => {
            assert.equal(await access(people.memberA, 2), false);
            assert.equal(await access(people.colleagueA, 1), false);
        });
        const previouslyAllowed = [];
        for (const user of Object.values(people)) {
            for (const [clientId] of clients) {
                if (await access(user, clientId)) previouslyAllowed.push([user, clientId]);
            }
        }
        const before = await businessData();
        await db.exec(migration);

        const cases = [
            ['colega A acessa cliente do colega B', people.memberA, 2, true],
            ['compartilhamento funciona também no sentido inverso', people.colleagueA, 1, true],
            ['owner sem linha de membro acessa cliente do colaborador', people.ownerA, 1, true],
            ['cliente novo sem snapshot usa empresa do autor', people.colleagueA, 7, true],
            ['usuário de outra empresa não acessa cliente legado', people.memberB, 1, false],
            ['colaborador não acessa cliente explícito de outra empresa', people.memberA, 6, false],
            ['membro pendente não ganha acesso compartilhado', people.pendingA, 1, false],
            ['membro bloqueado não ganha acesso compartilhado', people.blockedA, 1, false],
            ['perfil sem vínculo de membro não ganha acesso', people.unlinkedA, 1, false],
            ['visitante anônimo não ganha acesso', null, 1, false],
            ['cliente inexistente continua negado', people.memberA, 999, false],
            ['empresa do snapshot prevalece se autor mudou de empresa', people.colleagueA, 8, true],
            ['nova empresa do autor não herda o snapshot antigo', people.memberB, 8, false],
            ['empresa explícita do cliente prevalece sobre perfil do autor', people.colleagueA, 9, false],
            ['cliente sem empresa conhecida não ganha compartilhamento', people.colleagueA, 10, false],
        ];
        for (const [name, user, clientId, expected] of cases) {
            await t.test(name, async () => assert.equal(await access(user, clientId), expected));
        }
        await t.test('preserva todos os acessos já permitidos', async () => {
            for (const [user, clientId] of previouslyAllowed) assert.equal(await access(user, clientId), true);
        });
        await t.test('não altera nenhum registro de negócio', async () => assert.deepEqual(await businessData(), before));
        await t.test('migração não contém comandos de escrita ou remoção de dados', () => {
            const sqlWithoutComments = migration.replace(/--[^\n]*/g, '');
            assert.doesNotMatch(sqlWithoutComments, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER\s+TABLE)\b/i);
        });
        await t.test('somente o papel autenticado recebe execução', async () => {
            const { rows } = await db.query(`SELECT has_function_privilege('authenticated', 'public.can_access_proposal_client(bigint)', 'EXECUTE') AS authenticated,
                EXISTS (SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) acl
                    WHERE p.oid = 'public.can_access_proposal_client(bigint)'::regprocedure AND acl.grantee = 0) AS public_access`);
            assert.deepEqual(rows[0], { authenticated: true, public_access: false });
        });
        await t.test('consulta dos snapshots com RLS não recursa e mantém isolamento', async () => {
            await db.exec(`
                GRANT USAGE ON SCHEMA public, auth TO authenticated;
                GRANT SELECT ON public.proposal_option_states TO authenticated;
                ALTER TABLE public.proposal_option_states ENABLE ROW LEVEL SECURITY;
                CREATE POLICY proposal_option_states_select ON public.proposal_option_states
                    FOR SELECT TO authenticated USING (public.can_access_proposal_client(client_id));
                SET ROLE authenticated;
            `);
            try {
                await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [people.memberA]);
                assert.deepEqual((await db.query('SELECT client_id::integer FROM public.proposal_option_states ORDER BY client_id')).rows,
                    [1, 2, 3, 8].map(client_id => ({ client_id })));
                await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [people.memberB]);
                assert.deepEqual((await db.query('SELECT client_id::integer FROM public.proposal_option_states ORDER BY client_id')).rows,
                    [{ client_id: 5 }]);
            } finally {
                await db.exec('RESET ROLE');
            }
        });
    } finally {
        await db.close();
    }
});
