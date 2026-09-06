import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/agentic/controls";
import { useT } from "@/i18n";
import type { StepProps } from "../OnboardingFlow";
import { StepFooter } from "../primitives";

type Status = "idle" | "checking" | "granted" | "denied" | "unavailable" | "no_device" | "failed";

/** Probe the current browser's microphone, never the server's native TCC identity. */
export function BrowserMicrophoneAccess({ onReady }: { onReady?: (ready: boolean) => void }) {
  const t = useT();
  const supported = window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function";
  const [status, setStatus] = useState<Status>(supported ? "idle" : "unavailable");
  const mounted = useRef(false);
  const pending = useRef(false);
  const ready = status === "granted";

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { onReady?.(ready); }, [ready, onReady]);

  const request = async () => {
    if (pending.current || !supported) return;
    pending.current = true;
    setStatus("checking");
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const live = stream.getAudioTracks().some((track) => track.readyState === "live");
      if (mounted.current) setStatus(live ? "granted" : "no_device");
    } catch (error) {
      // Surface failures to the user; permission denial is recoverable through browser/OS settings.
      const name = error instanceof DOMException ? error.name : "";
      if (mounted.current) setStatus(
        name === "NotAllowedError" || name === "SecurityError" ? "denied"
          : name === "NotFoundError" ? "no_device" : "failed",
      );
    } finally {
      // A delayed permission response must release the device even after leaving this step.
      stream?.getTracks().forEach((track) => track.stop());
      pending.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-border p-5">
        <p className="text-sm text-muted-foreground">{t("onboarding.permissions.browser.description")}</p>
        <p role="status" aria-live="polite">{t(`onboarding.permissions.browser.${status}`)}</p>
        {!ready && <Button onClick={() => void request()} disabled={!supported || status === "checking"}>
          {t("onboarding.permissions.browser.request")}
        </Button>}
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {t("onboarding.permissions.browser.privacy_note")}
      </p>

    </div>
  );
}

export function BrowserPermissionsStep({ goNext, goBack, skip, setSummary, setGap }: StepProps) {
  const t = useT();
  const [ready, setReady] = useState(false);
  const onReady = useCallback((value: boolean) => setReady(value), []);
  useEffect(() => {
    setSummary(ready ? t("onboarding.permissions.browser.granted") : null);
    setGap(ready ? null : t("onboarding.permissions.browser.gap"));
  }, [ready, setSummary, setGap, t]);
  return <div className="space-y-6">
    <BrowserMicrophoneAccess onReady={onReady} />
      <StepFooter onBack={goBack}
        primary={{ label: t("onboarding.permissions.continue"), onClick: goNext, disabled: !ready }}
        secondary={ready ? null : {
          label: t("onboarding.permissions.text_only"),
          onClick: () => { setSummary(t("onboarding.permissions.summary_skipped")); skip(); },
          testId: "onboarding-permissions-skip",
        }}
      />
  </div>;
}
