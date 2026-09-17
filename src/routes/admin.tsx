import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  DatabaseZap,
  History,
  LogOut,
  Play,
  QrCode,
  RefreshCw,
  WashingMachine,
  Wind,
} from "lucide-react";
import { Nav } from "@/components/Nav";
import { MachineAccessCard } from "@/components/staff/MachineAccessCard";
import { StaffGate } from "@/components/staff/StaffGate";
import { StatusControls } from "@/components/staff/StatusControls";
import {
  SERVICE_LABEL,
  STATUS_SHORT_LABEL,
  formatWashDate,
  remainingMinutesForWash,
  type LaundryMachine,
  type LaundryMachineId,
  type Wash,
  type WashCreateInput,
  type WashServiceType,
  type WashStatus,
} from "@/lib/washes";
import "@/styles/app.css";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel do funcionário — LavTudo" },
      { name: "description", content: "Gestão das máquinas e ciclos LavTudo." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="lav-shell">
      <Nav />
      <StaffGate>{(session) => <EmployeeDashboard onLogout={session.logout} />}</StaffGate>
    </div>
  );
}

function EmployeeDashboard({ onLogout }: { onLogout: () => Promise<void> }) {
  const [machines, setMachines] = useState<LaundryMachine[]>([]);
  const [history, setHistory] = useState<Wash[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<LaundryMachineId | null>(null);
  const [selectedQrId, setSelectedQrId] = useState<LaundryMachineId | null>(null);
  const [startMachineId, setStartMachineId] = useState<LaundryMachineId | null>(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [machinesResponse, historyResponse] = await Promise.all([
        fetch("/api/machines", { cache: "no-store" }),
        fetch("/api/washes", { cache: "no-store" }),
      ]);
      const machinesBody = (await machinesResponse.json()) as {
        machines?: LaundryMachine[];
        error?: string;
      };
      const historyBody = (await historyResponse.json()) as { washes?: Wash[]; error?: string };
      if (!machinesResponse.ok || !machinesBody.machines) {
        throw new Error(machinesBody.error || "Falha ao carregar as máquinas.");
      }
      if (!historyResponse.ok || !historyBody.washes) {
        throw new Error(historyBody.error || "Falha ao carregar o histórico.");
      }
      setMachines(machinesBody.machines);
      setHistory(historyBody.washes);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o painel.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(true), 2500);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  const replaceMachine = (updated: LaundryMachine) => {
    setMachines((current) =>
      current.map((machine) => (machine.id === updated.id ? updated : machine)),
    );
  };

  const startWash = async (machineId: LaundryMachineId, input: WashCreateInput) => {
    setBusyId(machineId);
    setError(null);
    try {
      const response = await fetch(`/api/machines/${machineId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await response.json()) as { machine?: LaundryMachine; error?: string };
      if (!response.ok || !body.machine) throw new Error(body.error || "Falha ao iniciar ciclo.");
      replaceMachine(body.machine);
      setStartMachineId(null);
      setSelectedQrId(machineId);
      void loadDashboard(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível iniciar o ciclo.");
    } finally {
      setBusyId(null);
    }
  };

  const mutateMachine = async (
    machineId: LaundryMachineId,
    body: { status: WashStatus } | { action: "release" },
  ) => {
    setBusyId(machineId);
    setError(null);
    try {
      const response = await fetch(`/api/machines/${machineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { machine?: LaundryMachine; error?: string };
      if (!response.ok || !payload.machine) {
        throw new Error(payload.error || "Falha ao atualizar a máquina.");
      }
      replaceMachine(payload.machine);
      void loadDashboard(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o status.");
    } finally {
      setBusyId(null);
    }
  };

  const washers = useMemo(
    () => machines.filter((machine) => machine.kind === "washer"),
    [machines],
  );
  const dryers = useMemo(() => machines.filter((machine) => machine.kind === "dryer"), [machines]);
  const activeCount = machines.filter((machine) => machine.currentWash).length;
  const availableCount = machines.length - activeCount;
  const completedHistory = history.filter((wash) =>
    ["collected", "cancelled"].includes(wash.status),
  );

  return (
    <main className="container-page employee-page">
      <header className="page-heading employee-heading">
        <div>
          <p className="eyebrow">Operação LavTudo</p>
          <h1>Painel do funcionário</h1>
          <p>Gerencie as oito máquinas e acompanhe cada ciclo em tempo real.</p>
        </div>
        <div className="heading-actions">
          <Link className="button primary" to="/demo">
            <Play size={17} /> Modo demonstração
          </Link>
          <button className="button ghost" type="button" onClick={() => void loadDashboard()}>
            <RefreshCw size={17} /> Atualizar
          </button>
          <button className="button ghost" type="button" onClick={() => void onLogout()}>
            <LogOut size={17} /> Sair
          </button>
        </div>
      </header>

      <section className="dashboard-summary" aria-label="Resumo das máquinas">
        <SummaryCard label="Em operação" value={activeCount} icon={<WashingMachine />} />
        <SummaryCard label="Disponíveis" value={availableCount} icon={<Play />} />
        <SummaryCard label="Armazenamento" value="Supabase" icon={<DatabaseZap />} textual />
      </section>

      {error && (
        <div className="notice danger" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void loadDashboard()}>
            Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <div className="machine-admin-grid" aria-label="Carregando máquinas">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="glass skeleton-panel" key={index} />
          ))}
        </div>
      ) : (
        <>
          <MachineGroup
            title="Lavadoras"
            icon={<WashingMachine size={22} />}
            machines={washers}
            busyId={busyId}
            startMachineId={startMachineId}
            selectedQrId={selectedQrId}
            onStartOpen={setStartMachineId}
            onStart={startWash}
            onStatus={(machineId, status) => void mutateMachine(machineId, { status })}
            onRelease={(machineId) => void mutateMachine(machineId, { action: "release" })}
            onQr={(machineId) =>
              setSelectedQrId((current) => (current === machineId ? null : machineId))
            }
          />
          <MachineGroup
            title="Secadoras"
            icon={<Wind size={22} />}
            machines={dryers}
            busyId={busyId}
            startMachineId={startMachineId}
            selectedQrId={selectedQrId}
            onStartOpen={setStartMachineId}
            onStart={startWash}
            onStatus={(machineId, status) => void mutateMachine(machineId, { status })}
            onRelease={(machineId) => void mutateMachine(machineId, { action: "release" })}
            onQr={(machineId) =>
              setSelectedQrId((current) => (current === machineId ? null : machineId))
            }
          />
        </>
      )}

      <section className="admin-history-section" aria-labelledby="admin-history-title">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Registro operacional</p>
            <h2 id="admin-history-title">Histórico de ciclos</h2>
          </div>
          <span>{completedHistory.length} encerrados</span>
        </div>
        {completedHistory.length === 0 ? (
          <div className="glass empty-state compact-empty">
            <History size={28} />
            <p>Os ciclos liberados aparecerão aqui.</p>
          </div>
        ) : (
          <div className="history-table glass">
            {completedHistory.slice(0, 12).map((wash) => (
              <div className="history-table-row" key={wash.id}>
                <div>
                  <strong>{wash.machineLabel}</strong>
                  <span>
                    Ciclo #{wash.id} · {SERVICE_LABEL[wash.serviceType]}
                  </span>
                </div>
                <span>{STATUS_SHORT_LABEL[wash.status]}</span>
                <time dateTime={wash.updatedAt}>{formatWashDate(wash.updatedAt, true)}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function MachineGroup({
  title,
  icon,
  machines,
  busyId,
  startMachineId,
  selectedQrId,
  onStartOpen,
  onStart,
  onStatus,
  onRelease,
  onQr,
}: {
  title: string;
  icon: React.ReactNode;
  machines: LaundryMachine[];
  busyId: LaundryMachineId | null;
  startMachineId: LaundryMachineId | null;
  selectedQrId: LaundryMachineId | null;
  onStartOpen: (id: LaundryMachineId | null) => void;
  onStart: (id: LaundryMachineId, input: WashCreateInput) => Promise<void>;
  onStatus: (id: LaundryMachineId, status: WashStatus) => void;
  onRelease: (id: LaundryMachineId) => void;
  onQr: (id: LaundryMachineId) => void;
}) {
  return (
    <section className="machine-group" aria-labelledby={`group-${machines[0]?.kind}`}>
      <div className="machine-group-title">
        <span aria-hidden="true">{icon}</span>
        <div>
          <p className="eyebrow">Equipamentos permanentes</p>
          <h2 id={`group-${machines[0]?.kind}`}>{title}</h2>
        </div>
      </div>
      <div className="machine-admin-grid">
        {machines.map((machine) => {
          const wash = machine.currentWash;
          const remaining = wash ? remainingMinutesForWash(wash) : null;
          return (
            <article
              className={`glass machine-admin-card ${wash ? "is-busy" : "is-available"}`}
              key={machine.id}
            >
              <header>
                <div>
                  <span className="machine-permanent-id">{machine.id}</span>
                  <h3>{machine.label}</h3>
                </div>
                <span
                  className={`machine-state-pill ${wash ? `status-${wash.status}` : "status-available"}`}
                >
                  {wash ? STATUS_SHORT_LABEL[wash.status] : "Disponível"}
                </span>
              </header>

              {wash ? (
                <div className="machine-current-cycle">
                  <div>
                    <span>Ciclo atual</span>
                    <strong>#{wash.id}</strong>
                  </div>
                  <div>
                    <span>Tempo restante</span>
                    <strong>{wash.status === "ready" ? "Pronta" : `${remaining ?? 0} min`}</strong>
                  </div>
                  <div>
                    <span>Início</span>
                    <strong>{formatWashDate(wash.startedAt)}</strong>
                  </div>
                </div>
              ) : (
                <div className="machine-available-message">
                  <CheckCircle2 size={23} aria-hidden="true" />
                  <div>
                    <strong>Pronta para uso</strong>
                    <span>Nenhum ciclo associado.</span>
                  </div>
                </div>
              )}

              {wash && (
                <StatusControls
                  machine={machine}
                  busy={busyId === machine.id}
                  onStatus={(status) => onStatus(machine.id, status)}
                  onRelease={() => onRelease(machine.id)}
                />
              )}

              {startMachineId === machine.id && !wash && (
                <StartCycleForm
                  machine={machine}
                  busy={busyId === machine.id}
                  onCancel={() => onStartOpen(null)}
                  onStart={(input) => onStart(machine.id, input)}
                />
              )}

              <footer>
                {!wash && startMachineId !== machine.id && (
                  <button
                    className="button primary small"
                    type="button"
                    onClick={() => onStartOpen(machine.id)}
                  >
                    <Play size={16} /> Nova {machine.kind === "washer" ? "lavagem" : "secagem"}
                  </button>
                )}
                <button
                  className="button ghost small"
                  type="button"
                  onClick={() => onQr(machine.id)}
                  aria-expanded={selectedQrId === machine.id}
                >
                  <QrCode size={16} /> {selectedQrId === machine.id ? "Fechar QR" : "Ver QR fixo"}
                </button>
              </footer>

              {selectedQrId === machine.id && (
                <aside className="inline-machine-access" aria-label={`QR Code da ${machine.label}`}>
                  <MachineAccessCard machineId={machine.id} machineLabel={machine.label} compact />
                </aside>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StartCycleForm({
  machine,
  busy,
  onCancel,
  onStart,
}: {
  machine: LaundryMachine;
  busy: boolean;
  onCancel: () => void;
  onStart: (input: WashCreateInput) => Promise<void>;
}) {
  const initialService: WashServiceType = machine.kind === "dryer" ? "drying" : "standard";
  const [serviceType, setServiceType] = useState<WashServiceType>(initialService);
  const [estimatedMinutes, setEstimatedMinutes] = useState(machine.kind === "dryer" ? 30 : 45);
  const [startedAt, setStartedAt] = useState(() => toLocalDateTime(new Date()));

  return (
    <form
      className="start-cycle-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onStart({
          serviceType,
          estimatedMinutes,
          startedAt: new Date(startedAt).toISOString(),
        });
      }}
    >
      <div className="form-field">
        <label htmlFor={`service-${machine.id}`}>Tipo de ciclo</label>
        <select
          id={`service-${machine.id}`}
          value={serviceType}
          onChange={(event) => setServiceType(event.target.value as WashServiceType)}
        >
          {machine.kind === "dryer" ? (
            <option value="drying">Secagem</option>
          ) : (
            <>
              <option value="standard">Lavagem padrão</option>
              <option value="delicate">Roupas delicadas</option>
              <option value="heavy">Lavagem intensa</option>
            </>
          )}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor={`duration-${machine.id}`}>Duração estimada</label>
        <input
          id={`duration-${machine.id}`}
          type="number"
          min={5}
          max={240}
          value={estimatedMinutes}
          onChange={(event) => setEstimatedMinutes(Number(event.target.value))}
          required
        />
      </div>
      <div className="form-field full-row">
        <label htmlFor={`start-${machine.id}`}>Horário de início</label>
        <input
          id={`start-${machine.id}`}
          type="datetime-local"
          value={startedAt}
          onChange={(event) => setStartedAt(event.target.value)}
          required
        />
      </div>
      <div className="form-actions compact-actions">
        <button className="button ghost small" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="button primary small" type="submit" disabled={busy}>
          <Play size={15} /> {busy ? "Iniciando…" : "Iniciar ciclo"}
        </button>
      </div>
    </form>
  );
}

function toLocalDateTime(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function SummaryCard({
  label,
  value,
  icon,
  textual = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  textual?: boolean;
}) {
  return (
    <div className="glass summary-card">
      <span className="summary-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <strong className={textual ? "textual" : ""}>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
