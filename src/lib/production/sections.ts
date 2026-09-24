export const SECTIONS = [
  { id: "production", title: "Производство", url: "/" },
  { id: "products", title: "Изделия", url: "/products" },
  { id: "workcenters", title: "Участки", url: "/workcenters" },
  { id: "contracts", title: "Договоры", url: "/contracts" },
  { id: "journal", title: "Журнал", url: "/journal" },
  { id: "settings", title: "Настройки", url: "/settings" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
export type Access = "edit" | "view";
export type Permissions = Partial<Record<SectionId, Access>>;

export const SECTION_TITLE: Record<string, string> = Object.fromEntries(SECTIONS.map((s) => [s.id, s.title]));

/** Домен служебных адресов для входа по логину. */
export const LOGIN_DOMAIN = "factory.local";
export const loginToEmail = (login: string) =>
  login.includes("@") ? login.trim() : `${login.trim().toLowerCase()}@${LOGIN_DOMAIN}`;

/** Временный автовход под администратором (для разработки). Выключить: false. */
export const DEV_AUTOLOGIN = true;
export const DEV_ADMIN_LOGIN = "admin";
export const DEV_ADMIN_PASSWORD = "admin-dev-2026";
