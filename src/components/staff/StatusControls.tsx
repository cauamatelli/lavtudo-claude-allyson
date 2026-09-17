import { CheckCircle2, Gauge, PackageCheck, Play, Waves, Wind } from "lucide-react";
import {
  STATUS_SHORT_LABEL,
  stagesForMachine,
  type LaundryMachine,
  type WashStatus,
} from "@/lib/washes";

const ICONS: Partial<Record<WashStatus, React.ReactNode>> = {
  washing: <Play size={18} />,
  rinsing: <Waves size={18} />,
  spinning: <Gauge size={18} />,
  drying: <Wind size={18} />,
  ready: <CheckCircle2 size={18} />,
};

export function StatusControls({
  machine,
  busy,
  onStatus,
  onRelease,
}: {
  machine: LaundryMachine;
  busy: boolean;
  onStatus: (status: WashStatus) => void;
  onRelease: () => void;
}) {
  const wash = machine.currentWash;
  if (!wash) return null;
  const statuses = stagesForMachine(machine.kind);

  return (
    <div className="status-controls">
      {statuses.map((status) => (
        <button
          key={status}
          className={`stage-button ${wash.status === status ? "active" : ""} ${status === "ready" ? "success" : ""}`}
          type="button"
          onClick={() => onStatus(status)}
          disabled={busy}
          aria-pressed={wash.status === status}
        >
          {ICONS[status]}
          <span>
            {status === "washing"
              ? "Lavagem"
              : status === "ready"
                ? "Finalizar"
                : STATUS_SHORT_LABEL[status]}
          </span>
        </button>
      ))}
      {wash.status === "ready" && (
        <button className="stage-button release" type="button" onClick={onRelease} disabled={busy}>
          <PackageCheck size={18} />
          <span>Liberar máquina</span>
        </button>
      )}
    </div>
  );
}
