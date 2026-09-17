import { useState, type ReactNode } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useStaffSession } from "@/hooks/use-staff-session";

type StaffSession = ReturnType<typeof useStaffSession>;

export function StaffGate({ children }: { children: (session: StaffSession) => ReactNode }) {
  const session = useStaffSession();
  if (session.checking) return <StaffGateSkeleton />;
  if (!session.authenticated) return <StaffLogin session={session} />;
  return children(session);
}

function StaffLogin({ session }: { session: StaffSession }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await session.login(username, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="staff-login-wrap">
      <form className="glass staff-login-card" onSubmit={submit}>
        <div className="staff-login-icon" aria-hidden="true">
          <LockKeyhole size={28} />
        </div>
        <p className="eyebrow">Área da equipe</p>
        <h1>Acesso do funcionário</h1>
        <p className="muted-copy">
          Entre para criar lavagens e atualizar o acompanhamento dos clientes.
        </p>

        {!session.configured && (
          <div className="notice danger" role="alert">
            Configure as credenciais seguras do servidor antes de usar o painel.
          </div>
        )}

        <div className="form-field">
          <label htmlFor="staff-user">Usuário</label>
          <input
            id="staff-user"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="staff-password">Senha</label>
          <input
            id="staff-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className="notice danger" role="alert">
            {error}
          </div>
        )}

        <button className="button primary full" type="submit" disabled={submitting}>
          <ShieldCheck size={18} />
          {submitting ? "Entrando…" : "Entrar no painel"}
        </button>

        {session.developmentCredentials && (
          <p className="development-hint">Acesso administrativo protegido por sessão.</p>
        )}
      </form>
    </main>
  );
}

function StaffGateSkeleton() {
  return (
    <main className="staff-login-wrap" aria-label="Verificando sessão">
      <div className="glass staff-login-card">
        <div className="skeleton-line wide" />
        <div className="skeleton-line" />
        <div className="skeleton-block" />
      </div>
    </main>
  );
}
