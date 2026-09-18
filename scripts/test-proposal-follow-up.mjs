// Isolated PostgreSQL validation, without accessing Supabase or customer data.
// npm install --prefix tmp/follow-up-validation --no-save --package-lock=false @electric-sql/pglite
// node scripts/test-proposal-follow-up.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const modulePath = resolve(process.argv[2] || 'tmp/follow-up-validation/node_modules/@electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const actor = '11111111-1111-4111-8111-111111111111';
try {
    await db.exec(`
        CREATE ROLE authenticated;
        CREATE ROLE anon;
        CREATE SCHEMA auth;
        CREATE SCHEMA storage;
        CREATE TABLE auth.users(id uuid PRIMARY KEY);
        INSERT INTO auth.users VALUES ('${actor}');
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
            $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        SELECT set_config('request.jwt.claim.sub', '${actor}', false);
        CREATE TABLE public.clients(id bigint PRIMARY KEY, user_id uuid);
        INSERT INTO clients VALUES (1, '${actor}'), (2, NULL);
        CREATE FUNCTION public.can_access_proposal_client(target_client_id bigint) RETURNS boolean
            LANGUAGE sql AS $$ SELECT EXISTS (SELECT 1 FROM clients WHERE id = target_client_id AND user_id = auth.uid()) $$;
        CREATE TABLE public.saved_pdfs(id integer PRIMARY KEY, client_id bigint REFERENCES clients(id),
            subtotal numeric, total_preco numeric, general_discount_amount numeric,
            pdf_path text, pdf_blob text, archived_at timestamptz, status text DEFAULT 'pending');
        INSERT INTO saved_pdfs(id,client_id,subtotal,total_preco,general_discount_amount,pdf_path)
            VALUES (10,1,2032.80,1890.50,0,'old.pdf'), (11,1,3000,3000,0,'other.pdf'), (12,2,100,100,0,'private.pdf');
        CREATE TABLE storage.objects(bucket_id text, name text, owner_id text);
        INSERT INTO storage.objects VALUES ('pdfs','new.pdf','${actor}');
        CREATE TABLE proposal_portals(id integer PRIMARY KEY, last_activity_at timestamptz, updated_at timestamptz);
        INSERT INTO proposal_portals VALUES (1,'2020-01-01','2020-01-01'), (2,'2020-01-01','2020-01-01');
        CREATE TABLE proposal_portal_items(portal_id integer, saved_pdf_id integer,
            condition_original_value numeric, condition_final_value numeric,
            condition_discount_amount numeric, condition_discount_percent numeric,
            condition_expires_at timestamptz, condition_updated_at timestamptz, condition_updated_by uuid);
        INSERT INTO proposal_portal_items(portal_id,saved_pdf_id,condition_final_value)
            VALUES (1,10,1626.24),(1,11,3000),(2,10,1626.24);
    `);
    await db.exec(await readFile('supabase/migrations/20260915120000_persistent_proposal_follow_up.sql', 'utf8'));
    // Reproduce Supabase's direct default EXECUTE grant, then apply the fix.
    await db.exec('GRANT EXECUTE ON FUNCTION public.apply_proposal_follow_up(integer,numeric,text,jsonb,text) TO anon');
    await db.exec(await readFile('supabase/migrations/20260915123000_follow_up_explicit_function_permissions.sql', 'utf8'));
    assert.equal((await db.query("SELECT has_function_privilege('anon','public.apply_proposal_follow_up(integer,numeric,text,jsonb,text)','EXECUTE') AS allowed")).rows[0].allowed, false);
    const snapshot = async (id = 10) => (await db.query('SELECT to_jsonb(pdf) AS data FROM saved_pdfs pdf WHERE id=$1', [id])).rows[0].data;
    const apply = async (value, type = 'percentage', expected, path = 'new.pdf', id = 10) => (
        await db.query('SELECT apply_proposal_follow_up($1,$2,$3,$4::jsonb,$5) AS data',
            [id, value, type, JSON.stringify(expected || await snapshot(id)), path])
    ).rows[0].data;
    const initial = await snapshot();
    let result = await apply(20);
    assert.equal(result.total_preco, 1512.40);
    assert.equal(result.subtotal, 2032.80);
    assert.equal(result.follow_up_base_value, 1890.50);
    assert.equal(result.follow_up_discount_amount, 378.10);
    assert.equal(result.pdf_path, 'new.pdf');
    let history = (await db.query('SELECT * FROM proposal_follow_up_history')).rows;
    assert.equal(history.length, 1);
    assert.equal(history[0].created_by, actor);
    assert.equal(Number(history[0].value_before), 1890.50);
    assert.equal(Number(history[0].value_after), 1512.40);
    assert.ok(history[0].created_at);
    assert.equal(Number((await snapshot(11)).total_preco), 3000);
    assert.equal((await db.query('SELECT condition_final_value FROM proposal_portal_items WHERE saved_pdf_id=11')).rows[0].condition_final_value, '3000');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM proposal_portals WHERE last_activity_at > \'2020-01-01\'')).rows[0].n, 2);
    assert.equal((await apply(20)).total_preco, 1512.40);
    assert.equal((await apply(10)).total_preco, 1701.45);
    assert.equal((await apply(0)).total_preco, 1890.50);
    assert.equal((await snapshot()).follow_up_base_value, null);
    assert.equal((await apply(378.10, 'fixed')).total_preco, 1512.40);
    assert.equal((await apply(100)).total_preco, 0);
    assert.equal((await apply(0)).total_preco, 1890.50);
    await assert.rejects(apply(20, 'percentage', initial), /mudou em outro aparelho/);
    await assert.rejects(apply(101), /fora do limite/);
    await assert.rejects(apply(-1), /inválido/);
    await assert.rejects(apply('NaN'), /inválido/);
    await assert.rejects(apply(20, 'percentage', undefined, 'missing.pdf'), /PDF atualizado/);
    await assert.rejects(apply(20, 'percentage', undefined, 'new.pdf', 12), /indisponível/);
    assert.equal((await snapshot()).total_preco, 1890.50);
    history = (await db.query('SELECT * FROM proposal_follow_up_history')).rows;
    assert.equal(history.length, 7);
    console.log('PASS: migration; apply/replace/remove; 100%; currency; audit; old links; bundles; stale snapshots; invalid input; PDF failure; access control.');
} finally {
    await db.close();
}
