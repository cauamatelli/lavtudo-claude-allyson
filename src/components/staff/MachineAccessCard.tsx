import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, Nfc } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { trackingPath, type LaundryMachineId } from "@/lib/washes";

export function MachineAccessCard({
  machineId,
  machineLabel,
  compact = false,
}: {
  machineId: LaundryMachineId;
  machineLabel: string;
  compact?: boolean;
}) {
  const path = trackingPath(machineId);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(new URL(path, window.location.origin).toString());
  }, [path]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`tracking-access ${compact ? "compact" : ""}`}>
      <div className="qr-frame" role="img" aria-label={`QR Code permanente da ${machineLabel}`}>
        {url ? (
          <QRCodeSVG
            value={url}
            size={compact ? 116 : 176}
            level="M"
            marginSize={2}
            title={`Acompanhar ${machineLabel}`}
            bgColor="#ffffff"
            fgColor="#18065f"
          />
        ) : (
          <div className="qr-placeholder" />
        )}
      </div>
      <div className="tracking-access-copy">
        <p className="eyebrow">Cartão NFC com QR Code fixo</p>
        <h3>{machineLabel}</h3>
        <p>Imprima este QR no cartão NFC e grave no chip a mesma URL permanente desta máquina.</p>
        <code>{path}</code>
        <div className="inline-actions">
          <button className="button secondary small" type="button" onClick={copy} disabled={!url}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copiado" : "Copiar URL"}
          </button>
          <a
            className="button ghost small"
            href={`/api/qr/${machineId}`}
            download={`qr-${machineId}.svg`}
          >
            <Download size={16} />
            Baixar QR
          </a>
          <Link
            className="button ghost small"
            to="/acompanhar/$machineId"
            params={{ machineId }}
            target="_blank"
          >
            <ExternalLink size={16} />
            Abrir cliente
          </Link>
        </div>
        <div className="nfc-note">
          <Nfc size={17} aria-hidden="true" />
          URL fixa para registro NDEF URI. Ela não muda entre os ciclos.
        </div>
      </div>
    </div>
  );
}
