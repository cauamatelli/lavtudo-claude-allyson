export const WASH_STATUSES = [
  "waiting",
  "washing",
  "rinsing",
  "spinning",
  "drying",
  "ready",
  "collected",
  "cancelled",
] as const;

export type WashStatus = (typeof WASH_STATUSES)[number];

export const MACHINE_IDS = [
  "lavadora-01",
  "lavadora-02",
  "lavadora-03",
  "lavadora-04",
  "lavadora-pet",
  "secadora-01",
  "secadora-02",
  "secadora-03",
  "secadora-04",
] as const;

export type LaundryMachineId = (typeof MACHINE_IDS)[number];
export type LaundryMachineKind = "washer" | "dryer";
export type WashServiceType = "standard" | "delicate" | "heavy" | "drying";

export type WashHistoryEntry = {
  id: string;
  status: WashStatus;
  label: string;
  at: string;
  actor: "system" | "employee";
};

export type Wash = {
  id: string;
  machineId: LaundryMachineId;
  machineLabel: string;
  serviceType: WashServiceType;
  status: WashStatus;
  estimatedMinutes: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  readyAt: string | null;
  history: WashHistoryEntry[];
};

export type LaundryMachine = {
  id: LaundryMachineId;
  label: string;
  kind: LaundryMachineKind;
  position: number;
  currentWash: Wash | null;
};

export type WashCreateInput = {
  serviceType: WashServiceType;
  estimatedMinutes: number;
  startedAt: string;
};

const MACHINE_LABEL_OVERRIDES: Partial<Record<LaundryMachineId, string>> = {
  "lavadora-pet": "Lavadora Pet",
};

export const LAUNDRY_MACHINES: Array<Omit<LaundryMachine, "currentWash">> = (() => {
  const positionByKind: Record<LaundryMachineKind, number> = { washer: 0, dryer: 0 };
  return MACHINE_IDS.map((id) => {
    const kind: LaundryMachineKind = id.startsWith("lavadora") ? "washer" : "dryer";
    positionByKind[kind] += 1;
    return {
      id,
      label:
        MACHINE_LABEL_OVERRIDES[id] ??
        `${kind === "washer" ? "Lavadora" : "Secadora"} ${id.slice(-2)}`,
      kind,
      position: positionByKind[kind],
    };
  });
})();

export const STATUS_LABEL: Record<WashStatus, string> = {
  waiting: "Aguardando início",
  washing: "Lavagem em andamento",
  rinsing: "Enxágue em andamento",
  spinning: "Centrifugação em andamento",
  drying: "Secagem em andamento",
  ready: "Pronta para retirada",
  collected: "Máquina liberada",
  cancelled: "Operação cancelada",
};

export const STATUS_SHORT_LABEL: Record<WashStatus, string> = {
  waiting: "Aguardando",
  washing: "Lavando",
  rinsing: "Enxaguando",
  spinning: "Centrifugando",
  drying: "Secando",
  ready: "Pronta",
  collected: "Liberada",
  cancelled: "Cancelada",
};

export const CUSTOMER_STATUS_MESSAGE: Record<WashStatus, string> = {
  waiting: "O ciclo foi registrado e será iniciado em breve.",
  washing: "Suas roupas estão sendo lavadas.",
  rinsing: "O sabão está sendo removido das suas roupas.",
  spinning: "Suas roupas estão na etapa de centrifugação.",
  drying: "Suas roupas estão secando.",
  ready: "Sua roupa está pronta para retirada!",
  collected: "A máquina está disponível para um novo ciclo.",
  cancelled: "Esta operação foi cancelada. Procure um funcionário.",
};

export const SERVICE_LABEL: Record<WashServiceType, string> = {
  standard: "Lavagem padrão",
  delicate: "Roupas delicadas",
  heavy: "Lavagem intensa",
  drying: "Secagem",
};

export const WASHER_CONTROL_STATUSES: WashStatus[] = ["washing", "rinsing", "spinning", "ready"];

export const DRYER_CONTROL_STATUSES: WashStatus[] = ["drying", "ready"];

export function isWashStatus(value: unknown): value is WashStatus {
  return typeof value === "string" && WASH_STATUSES.includes(value as WashStatus);
}

export function isLaundryMachineId(value: unknown): value is LaundryMachineId {
  return typeof value === "string" && MACHINE_IDS.includes(value as LaundryMachineId);
}

export function stagesForMachine(
  kind: LaundryMachineKind,
  machineId?: LaundryMachineId,
): WashStatus[] {
  if (machineId === "lavadora-01") {
    return ["washing", "rinsing", "spinning", "drying", "ready"];
  }
  return kind === "washer" ? WASHER_CONTROL_STATUSES : DRYER_CONTROL_STATUSES;
}

export function progressForStatus(status: WashStatus, kind: LaundryMachineKind): number {
  if (kind === "dryer") {
    if (status === "drying") return 45;
    if (["ready", "collected"].includes(status)) return 100;
    return 0;
  }
  switch (status) {
    case "waiting":
      return 0;
    case "washing":
      return 25;
    case "rinsing":
      return 55;
    case "spinning":
      return 78;
    case "drying":
      return 85;
    case "ready":
    case "collected":
      return 100;
    case "cancelled":
      return 0;
  }
}

export function formatWashDate(value: string | null, includeDate = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    ...(includeDate ? { day: "2-digit", month: "2-digit", year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function remainingMinutesForWash(wash: Wash): number | null {
  if (!wash.startedAt || ["ready", "collected", "cancelled"].includes(wash.status)) return null;
  const estimatedEnd = new Date(wash.startedAt).getTime() + wash.estimatedMinutes * 60_000;
  return Math.min(
    wash.estimatedMinutes,
    Math.max(0, Math.ceil((estimatedEnd - Date.now()) / 60_000)),
  );
}

export function trackingPath(machineId: LaundryMachineId): string {
  return `/acompanhar/${machineId}`;
}
