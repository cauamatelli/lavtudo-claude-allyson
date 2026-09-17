import { useCallback, useEffect, useState } from "react";

type SessionState = {
  checking: boolean;
  authenticated: boolean;
  configured: boolean;
  developmentCredentials: boolean;
};

const INITIAL_STATE: SessionState = {
  checking: true,
  authenticated: false,
  configured: true,
  developmentCredentials: false,
};

export function useStaffSession() {
  const [state, setState] = useState(INITIAL_STATE);

  const check = useCallback(async () => {
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      const body = (await response.json()) as Omit<SessionState, "checking">;
      setState({ ...body, checking: false });
    } catch {
      setState((current) => ({ ...current, checking: false, authenticated: false }));
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = (await response.json()) as { authenticated?: boolean; error?: string };
    if (!response.ok || !body.authenticated) {
      throw new Error(body.error || "Não foi possível entrar.");
    }
    setState((current) => ({ ...current, authenticated: true }));
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/session", { method: "DELETE" });
    setState((current) => ({ ...current, authenticated: false }));
  }, []);

  return { ...state, login, logout, refresh: check };
}
