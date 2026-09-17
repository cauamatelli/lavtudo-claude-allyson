import { useEffect, useRef } from "react";

type Props = {
  onResult: (text: string) => void;
  onError?: (err: string) => void;
};

/**
 * Client-only QR scanner using html5-qrcode.
 * Dynamically imported to avoid SSR issues.
 */
export function QRScanner({ onResult, onError }: Props) {
  const containerId = "qr-reader-box";
  const startedRef = useRef(false);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        const { Html5Qrcode } = mod;
        const instance = new Html5Qrcode(containerId);
        scanner = {
          stop: () => instance.stop(),
          clear: () => instance.clear(),
        };
        startedRef.current = true;
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            onResultRef.current(decoded);
          },
          () => {
            // ignore per-frame failures
          },
        );
      } catch (e) {
        onErrorRef.current?.(e instanceof Error ? e.message : "Não foi possível iniciar a câmera.");
      }
    })();

    return () => {
      cancelled = true;
      if (scanner && startedRef.current) {
        scanner
          .stop()
          .then(() => scanner?.clear())
          .catch(() => {});
      }
    };
  }, []);

  return <div id={containerId} />;
}
