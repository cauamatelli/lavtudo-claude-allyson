import "@tanstack/react-start/server-only";

const COOKIE_NAME = "lavtudo_session";
const SESSION_HOURS = 12;

type AuthConfig = {
  configured: boolean;
  username: string;
  password: string;
  sessionSecret: string;
  usingDevelopmentCredentials: boolean;
};

function getAuthConfig(): AuthConfig {
  const username = process.env.LAVTUDO_ADMIN_USER?.trim() || "admin";
  const password = process.env.LAVTUDO_ADMIN_PASSWORD?.trim() || "admin";
  const configuredSecret = process.env.LAVTUDO_SESSION_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === "production";
  return {
    configured: Boolean(configuredSecret) || !isProduction,
    username,
    password,
    sessionSecret: configuredSecret || "lavtudo-development-session-cookie-v1",
    usingDevelopmentCredentials: !configuredSecret,
  };
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

async function sign(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function cookieValue(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return null;
}

export function authConfiguration() {
  const config = getAuthConfig();
  return {
    configured: config.configured,
    usingDevelopmentCredentials: config.usingDevelopmentCredentials,
  };
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const config = getAuthConfig();
  return (
    config.configured &&
    safeEqual(username, config.username) &&
    safeEqual(password, config.password)
  );
}

export async function createSessionCookie(request: Request): Promise<string> {
  const config = getAuthConfig();
  const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = `${config.username}|${expiresAt}`;
  const signature = await sign(payload, config.sessionSecret);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(`${payload}.${signature}`)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 60 * 60}${secure}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  const config = getAuthConfig();
  if (!config.configured) return false;
  const encoded = cookieValue(request);
  if (!encoded) return false;

  let value: string;
  try {
    value = decodeURIComponent(encoded);
  } catch {
    return false;
  }

  const separator = value.lastIndexOf(".");
  if (separator < 1) return false;
  const payload = value.slice(0, separator);
  const providedSignature = value.slice(separator + 1);
  const [username, expiresText] = payload.split("|");
  const expiresAt = Number(expiresText);
  if (username !== config.username || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const expectedSignature = await sign(payload, config.sessionSecret);
  return safeEqual(providedSignature, expectedSignature);
}
