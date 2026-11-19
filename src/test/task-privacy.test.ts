// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
let id: string;

async function asUser(user: string) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role authenticated;
    create role service_role;
    create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to authenticated;
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0000_private_tasks.sql", import.meta.url), "utf8"));
  await db.exec("set role authenticated");
  await asUser(owner);
  const result = await db.query<{ id: string }>("insert into public.tasks (title) values ('Comprar pan') returning id");
  const [task] = result.rows;
  if (!task) throw new Error("Expected the owner’s task to be created");
  id = task.id;
}, 20_000);

afterAll(async () => { await db?.close(); });

describe("private tasks", () => {
  it("lets an account see its own task but not another account's task", async () => {
    await asUser(owner);
    expect((await db.query("select title from public.tasks where id = $1", [id])).rows).toEqual([{ title: "Comprar pan" }]);
    await asUser(other);
    expect((await db.query("select title from public.tasks where id = $1", [id])).rows).toEqual([]);
  });

  it("assigns new tasks to the signed-in account and prevents creating one for another account", async () => {
    await asUser(other);
    expect((await db.query("insert into public.tasks (title) values ('Leer un libro') returning user_id, completed")).rows)
      .toEqual([{ user_id: other, completed: false }]);
    await expect(db.query("insert into public.tasks (title, user_id) values ('Tarea ajena', $1)", [owner])).rejects.toMatchObject({ code: "42501" });
  });

  it("lets only the owner mark a task as done", async () => {
    await asUser(other);
    expect((await db.query("update public.tasks set completed = true where id = $1 returning completed", [id])).rows).toEqual([]);
    await asUser(owner);
    expect((await db.query("update public.tasks set completed = true where id = $1 returning completed", [id])).rows).toEqual([{ completed: true }]);
  });

  it("lets only the owner delete a task", async () => {
    const sql = "delete from public.tasks where id = $1 returning title";
    await asUser(other);
    expect((await db.query(sql, [id])).rows).toEqual([]);
    await asUser(owner);
    expect((await db.query(sql, [id])).rows).toEqual([{ title: "Comprar pan" }]);
  });

  it("denies anonymous access to the task list", async () => {
    await db.exec("set role anon");
    await expect(db.query("select title from public.tasks")).rejects.toMatchObject({ code: "42501" });
    await db.exec("set role authenticated");
  });
});
