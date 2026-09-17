import "@tanstack/react-start/server-only";

import type { LaundryMachine, LaundryMachineId, Wash, WashCreateInput, WashStatus } from "./washes";

type SupabaseConfig = {
  url: string;
  publishableKey: string;
  secretKey: string;
};

type SupabaseAccess = "public" | "admin";

export class DatabaseConfigurationError extends Error {
  readonly missingKeys: string[];

  constructor(missingKeys: string[]) {
    super(`Variáveis de banco ausentes: ${missingKeys.join(", ")}`);
    this.name = "DatabaseConfigurationError";
    this.missingKeys = missingKeys;
  }
}

export class SupabaseRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "SupabaseRequestError";
    this.status = status;
    this.code = code;
  }
}

type DatabaseErrorDescription = {
  status: number;
  publicMessage: string;
  reason: string;
};

export function describeDatabaseError(
  error: unknown,
  fallbackMessage: string,
): DatabaseErrorDescription {
  if (error instanceof DatabaseConfigurationError) {
    return {
      status: 503,
      publicMessage: "O banco de dados ainda não está configurado neste ambiente.",
      reason: `missing_environment:${error.missingKeys.join(",")}`,
    };
  }

  if (error instanceof SupabaseRequestError) {
    if (error.status === 401 || error.status === 403) {
      return {
        status: 503,
        publicMessage: "A conexão segura com o banco de dados precisa ser reconfigurada.",
        reason: `supabase_auth:${error.status}:${error.code ?? "unknown"}`,
      };
    }

    if (error.code === "PGRST202" || error.code === "42P01" || error.code === "42883") {
      return {
        status: 503,
        publicMessage: "A estrutura do banco de dados ainda não está pronta.",
        reason: `supabase_schema:${error.status}:${error.code}`,
      };
    }

    return {
      status: error.status >= 500 ? 503 : error.status,
      publicMessage: fallbackMessage,
      reason: `supabase_request:${error.status}:${error.code ?? "unknown"}`,
    };
  }

  if (error instanceof TypeError) {
    return {
      status: 503,
      publicMessage: "Não foi possível conectar ao banco de dados agora.",
      reason: "supabase_network",
    };
  }

  return {
    status: 503,
    publicMessage: fallbackMessage,
    reason: "unexpected_database_error",
  };
}

export function logDatabaseError(context: string, error: unknown): void {
  const description = describeDatabaseError(error, "Falha inesperada no banco de dados.");
  console.error(`[LavTudo] ${context}`, {
    reason: description.reason,
    errorName: error instanceof Error ? error.name : typeof error,
  });
}

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/u, "") || "";
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim() || "";
  const missingKeys = [
    !url && "SUPABASE_URL",
    !publishableKey && "SUPABASE_PUBLISHABLE_KEY",
    !secretKey && "SUPABASE_SECRET_KEY",
  ].filter((key): key is string => Boolean(key));

  if (missingKeys.length > 0) throw new DatabaseConfigurationError(missingKeys);

  return {
    url,
    publishableKey,
    secretKey,
  };
}

function databaseAdminCredentials() {
  return {
    p_user: process.env.LAVTUDO_ADMIN_USER?.trim() || "admin",
    p_password: process.env.LAVTUDO_ADMIN_PASSWORD?.trim() || "admin",
  };
}

async function supabaseRpc<T>(
  name: string,
  parameters: Record<string, unknown>,
  accessHeaders: Record<string, string>,
  access: SupabaseAccess,
): Promise<T> {
  const config = getSupabaseConfig();
  const key = access === "admin" ? config.secretKey : config.publishableKey;
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...accessHeaders,
    },
    body: JSON.stringify(parameters),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    } | null;
    throw new SupabaseRequestError(
      body?.message ||
        body?.details ||
        body?.hint ||
        `Supabase respondeu com HTTP ${response.status}.`,
      response.status,
      body?.code,
    );
  }

  return (await response.json()) as T;
}

export function storageMode(): "supabase" {
  return "supabase";
}

export async function listWashes(): Promise<Wash[]> {
  const credentials = databaseAdminCredentials();
  return supabaseRpc<Wash[]>(
    "lavtudo_list_washes",
    credentials,
    {
      "X-LavTudo-Admin-User": credentials.p_user,
      "X-LavTudo-Admin-Password": credentials.p_password,
    },
    "admin",
  );
}

export async function listMachines(): Promise<LaundryMachine[]> {
  const credentials = databaseAdminCredentials();
  return supabaseRpc<LaundryMachine[]>(
    "lavtudo_list_machines",
    credentials,
    {
      "X-LavTudo-Admin-User": credentials.p_user,
      "X-LavTudo-Admin-Password": credentials.p_password,
    },
    "admin",
  );
}

export async function findMachine(id: LaundryMachineId): Promise<LaundryMachine | undefined> {
  const machine = await supabaseRpc<LaundryMachine | null>(
    "lavtudo_get_machine",
    { p_id: id },
    { "X-LavTudo-Machine-Id": id },
    "public",
  );
  return machine ?? undefined;
}

export async function createWash(
  machineId: LaundryMachineId,
  input: WashCreateInput,
): Promise<LaundryMachine> {
  const credentials = databaseAdminCredentials();
  return supabaseRpc<LaundryMachine>(
    "lavtudo_start_machine_wash",
    {
      ...credentials,
      p_machine_id: machineId,
      p_service_type: input.serviceType,
      p_estimated_minutes: input.estimatedMinutes,
      p_started_at: input.startedAt,
    },
    {
      "X-LavTudo-Admin-User": credentials.p_user,
      "X-LavTudo-Admin-Password": credentials.p_password,
    },
    "admin",
  );
}

export async function setMachineStatus(
  machineId: LaundryMachineId,
  status: WashStatus,
): Promise<LaundryMachine | undefined> {
  const credentials = databaseAdminCredentials();
  const machine = await supabaseRpc<LaundryMachine | null>(
    "lavtudo_set_machine_status",
    { ...credentials, p_machine_id: machineId, p_status: status },
    {
      "X-LavTudo-Admin-User": credentials.p_user,
      "X-LavTudo-Admin-Password": credentials.p_password,
    },
    "admin",
  );
  return machine ?? undefined;
}

export async function releaseMachine(
  machineId: LaundryMachineId,
): Promise<LaundryMachine | undefined> {
  const credentials = databaseAdminCredentials();
  const machine = await supabaseRpc<LaundryMachine | null>(
    "lavtudo_release_machine",
    { ...credentials, p_machine_id: machineId },
    {
      "X-LavTudo-Admin-User": credentials.p_user,
      "X-LavTudo-Admin-Password": credentials.p_password,
    },
    "admin",
  );
  return machine ?? undefined;
}
