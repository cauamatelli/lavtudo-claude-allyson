import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  History,
  RefreshCw,
  Shirt,
  WashingMachine,
} from "lucide-react";
import { Nav } from "@/components/Nav";
import { useMachinePolling } from "@/hooks/use-machine-polling";
import {
  CUSTOMER_STATUS_MESSAGE,
  LAUNDRY_MACHINES,
  SERVICE_LABEL,
  STATUS_LABEL,
  STATUS_SHORT_LABEL,
  formatWashDate,
  isLaundryMachineId,
  progressForStatus,
  remainingMinutesForWash,
  stagesForMachine,
  type LaundryMachine,
  type LaundryMachineId,
  type Wash,
} from "@/lib/washes";
import "@/styles/app.css";

export const Route = createFileRoute("/acompanhar/$machineId")({
  beforeLoad: ({ params }) => {
    if (!isLaundryMachineId(params.machineId)) throw notFound();
  },
  head: ({ params }) => {
    const machine = LAUNDRY_MACHINES.find((item) => item.id === params.machineId);
    const label = machine?.label || "Máquina";
    return {
      meta: [
        { title: `${label} — Acompanhamento LavTudo` },
        {
          name: "description",
          content: `Acompanhe em tempo real o ciclo da ${label} na LavTudo.`,
        },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  component: TrackingPage,
  notFoundComponent: TrackingNotFound,
});

function TrackingPage() {
  const { machineId } = Route.useParams();
  const { machine, loading, error, retry } = useMachinePolling(machineId as LaundryMachineId);

  return (
    <div className="lav-shell tracking-shell">
      <Nav compact />
      <main className="container-page tracking-page">
        <div className="tracking-topbar">
          <Link to="/scan" className="back-link">
            ← Voltar
          </Link>
        </div>

        {loading && !machine ? (
          <TrackingSkeleton />
        ) : !machine ? (
          <TrackingError message={error || "Máquina não encontrada."} onRetry={retry} />
        ) : machine.currentWash ? (
          <TrackingContent
            machine={machine}
            wash={machine.currentWash}
            transientError={error}
            onRetry={retry}
          />
        ) : (
          <AvailableMachine machine={machine} transientError={error} onRetry={retry} />
        )}
      </main>
    </div>
  );
}

function AvailableMachine({
  machine,
  transientError,
  onRetry,
}: {
  machine: LaundryMachine;
  transientError: string | null;
  onRetry: () => void;
}) {
  return (
    <>
      {transientError && <ReconnectNotice onRetry={onRetry} />}
      <section className="glass customer-status-card is-available" aria-live="polite">
        <div className="order-number-row">
          <div>
            <p className="eyebrow">Acompanhamento da máquina</p>
            <h1>{machine.label}</h1>
          </div>
          <span className="status-chip status-available">Disponível</span>
        </div>
        <div className="status-hero-icon" aria-hidden="true">
          <CheckCircle2 size={48} />
        </div>
        <p className="customer-status-label">Máquina disponível</p>
        <h2>Nenhuma lavagem em andamento no momento.</h2>
        <p className="available-machine-copy">
          Use o mesmo QR Code ou cartão NFC quando esta máquina estiver em operação.
        </p>
      </section>
    </>
  );
}

function TrackingContent({
  machine,
  wash,
  transientError,
  onRetry,
}: {
  machine: LaundryMachine;
  wash: Wash;
  transientError: string | null;
  onRetry: () => void;
}) {
  const stages = stagesForMachine(machine.kind, machine.id);
  const progress = progressForStatus(wash.status, machine.kind);
  const currentStageIndex = stages.indexOf(wash.status);
  const complete = wash.status === "ready";
  const exceptional = wash.status === "cancelled";
  const estimatedReady = wash.startedAt
    ? new Date(new Date(wash.startedAt).getTime() + wash.estimatedMinutes * 60_000).toISOString()
    : null;
  const remainingMinutes = remainingMinutesForWash(wash);

  return (
    <>
      {transientError && <ReconnectNotice onRetry={onRetry} />}

      <section
        className={`glass customer-status-card ${complete ? "is-ready" : ""} ${exceptional ? "is-cancelled" : ""}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="order-number-row">
          <div>
            <p className="eyebrow">Acompanhamento da máquina</p>
            <h1>{machine.label}</h1>
            <span className="current-wash-id">Ciclo atual #{wash.id}</span>
          </div>
          <span className={`status-chip status-${wash.status}`}>
            {STATUS_SHORT_LABEL[wash.status]}
          </span>
        </div>

        <div className="status-hero-icon" aria-hidden="true">
          {complete ? <CheckCircle2 size={48} /> : <Shirt size={44} />}
        </div>
        <p className="customer-status-label">{STATUS_LABEL[wash.status]}</p>
        <h2>{CUSTOMER_STATUS_MESSAGE[wash.status]}</h2>

        {!exceptional && (
          <div className="tracking-time-summary">
            <Clock3 size={22} aria-hidden="true" />
            <div>
              <strong>
                {complete
                  ? "Disponível para retirada"
                  : `${remainingMinutes ?? 0} minutos restantes`}
              </strong>
              <span>
                {estimatedReady
                  ? `${complete ? "Finalizada" : "Previsão de término"}: ${formatWashDate(
                      complete ? wash.readyAt : estimatedReady,
                    )}`
                  : "A previsão será exibida assim que o ciclo começar."}
              </span>
            </div>
          </div>
        )}

        {!exceptional && (
          <div className="tracking-progress-wrap">
            <div className="tracking-progress-labels">
              <span>Progresso</span>
              <strong>{progress}%</strong>
            </div>
            <div
              className="tracking-progress"
              role="progressbar"
              aria-label="Progresso do ciclo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <p className="last-update">Atualizado às {formatWashDate(wash.updatedAt)}</p>
      </section>

      <div className="customer-detail-grid">
        <section className="glass detail-card" aria-labelledby="details-title">
          <div className="section-heading">
            <WashingMachine size={21} aria-hidden="true" />
            <h2 id="details-title">Detalhes do ciclo</h2>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Máquina</dt>
              <dd>{machine.label}</dd>
            </div>
            <div>
              <dt>Serviço</dt>
              <dd>{SERVICE_LABEL[wash.serviceType]}</dd>
            </div>
            <div>
              <dt>Início</dt>
              <dd>{formatWashDate(wash.startedAt)}</dd>
            </div>
            <div>
              <dt>{complete ? "Finalizada" : "Previsão"}</dt>
              <dd>{formatWashDate(complete ? wash.readyAt : estimatedReady)}</dd>
            </div>
            {!complete && remainingMinutes !== null && (
              <div>
                <dt>Tempo restante</dt>
                <dd>{remainingMinutes} min</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="glass timeline-card" aria-labelledby="steps-title">
          <div className="section-heading">
            <Clock3 size={21} aria-hidden="true" />
            <h2 id="steps-title">Etapas do ciclo</h2>
          </div>
          <ol className={`customer-timeline stages-${stages.length}`}>
            {stages.map((status, index) => {
              const done = complete || currentStageIndex > index;
              const current = currentStageIndex === index && !complete;
              return (
                <li key={status} className={`${done ? "done" : ""} ${current ? "current" : ""}`}>
                  <span className="timeline-marker">
                    {done ? <CheckCircle2 size={18} /> : index + 1}
                  </span>
                  <span>{STATUS_SHORT_LABEL[status]}</span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <section className="glass history-card" aria-labelledby="history-title">
        <div className="section-heading">
          <History size={21} aria-hidden="true" />
          <h2 id="history-title">Histórico deste ciclo</h2>
        </div>
        <ol className="history-list">
          {[...wash.history].reverse().map((entry) => (
            <li key={entry.id}>
              <span className={`history-dot status-${entry.status}`} aria-hidden="true" />
              <div>
                <strong>{entry.label}</strong>
                <time dateTime={entry.at}>{formatWashDate(entry.at, true)}</time>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function ReconnectNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="notice warning reconnect-notice" role="status">
      <AlertCircle size={18} />
      <span>Exibindo a última atualização. Tentando reconectar…</span>
      <button type="button" onClick={onRetry}>
        Tentar agora
      </button>
    </div>
  );
}

function TrackingError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="glass centered-state" role="alert">
      <AlertCircle size={42} aria-hidden="true" />
      <h1>Não foi possível abrir o acompanhamento</h1>
      <p>{message}</p>
      <button className="button primary" type="button" onClick={onRetry}>
        <RefreshCw size={17} />
        Tentar novamente
      </button>
    </section>
  );
}

function TrackingNotFound() {
  return (
    <div className="lav-shell">
      <Nav compact />
      <main className="container-page">
        <TrackingError
          message="Esta URL não corresponde a uma máquina LavTudo."
          onRetry={() => location.assign("/scan")}
        />
      </main>
    </div>
  );
}

function TrackingSkeleton() {
  return (
    <div className="tracking-skeleton" aria-label="Carregando acompanhamento">
      <div className="glass skeleton-panel large" />
      <div className="customer-detail-grid">
        <div className="glass skeleton-panel" />
        <div className="glass skeleton-panel" />
      </div>
    </div>
  );
}
