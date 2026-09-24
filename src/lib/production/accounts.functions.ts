import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEV_ADMIN_LOGIN, DEV_ADMIN_PASSWORD, DEV_AUTOLOGIN, SECTIONS, loginToEmail } from "./sections";

export type Account = {
  id: string;
  login: string;
  name: string;
  isAdmin: boolean;
  permissions: Record<string, "edit" | "view">;
};

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Доступ только для администратора");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function log(context: Ctx, action: string, entity: string) {
  const { data: p } = await context.supabase.from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
  await context.supabase.from("audit_log").insert({
    user_id: context.userId,
    user_name: p?.display_name ?? null,
    section: "settings",
    action,
    entity,
  });
}

/** Создаёт служебную учётку администратора для автовхода (только при DEV_AUTOLOGIN). */
export const ensureDevAdmin = createServerFn({ method: "POST" }).handler(async () => {
  if (!DEV_AUTOLOGIN) return { ok: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = loginToEmail(DEV_ADMIN_LOGIN);
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: DEV_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { name: "Администратор" },
    });
    if (error) throw new Error(error.message);
    user = data.user;
  }
  await supabaseAdmin.from("user_roles").upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
  await supabaseAdmin.from("profiles").update({ login: DEV_ADMIN_LOGIN }).eq("id", user.id);
  return { ok: true };
});

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Account[]> => {
    const admin = await assertAdmin(context);
    const [{ data: users }, { data: profiles }, { data: roles }, { data: perms }] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("profiles").select("id, display_name, login"),
      admin.from("user_roles").select("user_id, role"),
      admin.from("section_permissions").select("*"),
    ]);
    return (users?.users ?? []).map((u) => {
      const p = profiles?.find((x) => x.id === u.id);
      const permissions: Record<string, "edit" | "view"> = {};
      for (const r of perms ?? []) if (r.user_id === u.id) permissions[r.section] = r.can_edit ? "edit" : "view";
      return {
        id: u.id,
        login: p?.login ?? u.email?.split("@")[0] ?? "",
        name: p?.display_name ?? "",
        isAdmin: !!roles?.some((r) => r.user_id === u.id && r.role === "admin"),
        permissions,
      };
    });
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        login: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9._-]+$/, "Логин: латиница, цифры, . _ -"),
        name: z.string().trim().max(100),
        password: z.string().min(6).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { data: created, error } = await admin.auth.admin.createUser({
      email: loginToEmail(data.login),
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name || data.login },
    });
    if (error) throw new Error(error.message);
    await admin.from("profiles").update({ login: data.login.toLowerCase() }).eq("id", created.user.id);
    await admin.from("user_roles").insert({ user_id: created.user.id, role: "viewer" });
    await admin
      .from("section_permissions")
      .insert(SECTIONS.filter((s) => s.id !== "settings").map((s) => ({ user_id: created.user.id, section: s.id, can_edit: false })));
    await log(context, "Создана учётная запись", data.login);
    return { id: created.user.id };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), login: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id === context.userId) throw new Error("Нельзя удалить свою учётную запись");
    const admin = await assertAdmin(context);
    const { error } = await admin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    await log(context, "Удалена учётная запись", data.login);
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), login: z.string(), password: z.string().min(6).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { error } = await admin.auth.admin.updateUserById(data.id, { password: data.password });
    if (error) throw new Error(error.message);
    await log(context, "Сменён пароль", data.login);
    return { ok: true };
  });

export const setPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        login: z.string(),
        isAdmin: z.boolean(),
        permissions: z.record(z.string(), z.enum(["edit", "view"])),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    if (data.id === context.userId && !data.isAdmin) throw new Error("Нельзя снять права администратора с себя");
    await admin.from("section_permissions").delete().eq("user_id", data.id);
    const rows = Object.entries(data.permissions)
      .filter(([s]) => SECTIONS.some((x) => x.id === s))
      .map(([section, a]) => ({ user_id: data.id, section, can_edit: a === "edit" }));
    if (rows.length) {
      const { error } = await admin.from("section_permissions").insert(rows);
      if (error) throw new Error(error.message);
    }
    if (data.isAdmin) await admin.from("user_roles").upsert({ user_id: data.id, role: "admin" }, { onConflict: "user_id,role" });
    else await admin.from("user_roles").delete().eq("user_id", data.id).eq("role", "admin");
    await log(context, "Изменены права доступа", data.login);
    return { ok: true };
  });

export const listJournal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const start = new Date(`${data.date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const { data: rows, error } = await context.supabase
      .from("audit_log")
      .select("*")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return rows as { id: string; created_at: string; user_name: string | null; section: string; action: string; entity: string | null }[];
  });
