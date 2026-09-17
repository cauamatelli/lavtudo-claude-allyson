import { Link } from "@tanstack/react-router";
import { Home, QrCode } from "lucide-react";
import "@/styles/app.css";

export function Nav({ compact = false }: { compact?: boolean }) {
  return (
    <nav className={`lav-nav ${compact ? "compact" : ""}`} aria-label="Navegação principal">
      <Link to="/" className="lav-nav-brand">
        <img src="/lavtudo-logo.webp" alt="Logo LavTudo Lavanderia Express 24 horas" />
        <span>LavTudo</span>
      </Link>
      <div className="lav-nav-links">
        <Link
          to="/"
          className="lav-nav-link"
          aria-label="Início"
          activeProps={{ className: "lav-nav-link active" }}
          activeOptions={{ exact: true }}
        >
          <Home size={17} aria-hidden="true" />
          <span className="nav-link-label">Início</span>
        </Link>
        <Link
          to="/scan"
          className="lav-nav-link"
          aria-label="Ler cartão NFC ou QR Code para acompanhar lavagem"
          activeProps={{ className: "lav-nav-link active" }}
        >
          <QrCode size={17} aria-hidden="true" />
          <span className="nav-link-label">Ler cartão</span>
        </Link>
      </div>
    </nav>
  );
}
