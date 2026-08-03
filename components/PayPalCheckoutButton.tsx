"use client";

import { useEffect, useRef, useState } from "react";

type PayPalConfig =
  | { enabled: false }
  | {
      enabled: true;
      clientId: string;
      environment: "sandbox" | "live";
      currency: string;
    };

type PayPalButtonsInstance = {
  render: (element: HTMLElement) => Promise<void>;
  close?: () => Promise<void>;
};

type PayPalNamespace = {
  Buttons: (options: {
    style: Record<string, string | number>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel: () => void;
    onError: (error?: unknown) => void;
  }) => PayPalButtonsInstance;
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

export default function PayPalCheckoutButton({
  onMode,
  onPaid,
}: {
  onMode: (mode: "manual" | "sandbox" | "live") => void;
  onPaid: () => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paymentRequestIdRef = useRef("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let buttons: PayPalButtonsInstance | undefined;
    let automatedModeSelected = false;

    // Diagnostic uniquement : ne doit jamais casser le tunnel de paiement.
    async function reportOutcome(
      outcome: "cancelled" | "error",
      detail?: string,
    ) {
      const paymentRequestId = paymentRequestIdRef.current;
      if (!paymentRequestId) return;

      try {
        await fetch("/api/paypal/report-outcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentRequestId, outcome, detail }),
          keepalive: true,
        });
      } catch {
        // Ignoré volontairement.
      }
    }

    async function setup() {
      const response = await fetch("/api/paypal/config", { cache: "no-store" });
      const config = (await response.json()) as PayPalConfig;
      if (!config.enabled) {
        onMode("manual");
        return;
      }

      automatedModeSelected = true;
      onMode(config.environment);
      const scriptId = "firstreply-paypal-sdk";
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
          config.clientId,
        )}&currency=${config.currency}&intent=capture`;
        script.async = true;
        document.head.appendChild(script);
        await new Promise<void>((resolve, reject) => {
          script?.addEventListener("load", () => resolve(), { once: true });
          script?.addEventListener(
            "error",
            () => reject(new Error("PayPal SDK failed to load.")),
            { once: true },
          );
        });
      } else if (!window.paypal) {
        await new Promise<void>((resolve, reject) => {
          script?.addEventListener("load", () => resolve(), { once: true });
          script?.addEventListener(
            "error",
            () => reject(new Error("PayPal SDK failed to load.")),
            { once: true },
          );
        });
      }

      if (cancelled || !window.paypal || !containerRef.current) return;
      buttons = window.paypal.Buttons({
        style: {
          layout: "vertical",
          shape: "rect",
          label: "paypal",
          height: 48,
        },
        async createOrder() {
          setError("");
          const orderResponse = await fetch("/api/paypal/create-order", {
            method: "POST",
          });
          const order = await orderResponse.json();
          if (!orderResponse.ok || !order.orderId || !order.paymentRequestId) {
            throw new Error(order.error || "Commande PayPal indisponible.");
          }
          paymentRequestIdRef.current = order.paymentRequestId;
          return order.orderId;
        },
        async onApprove(data) {
          const captureResponse = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: data.orderID,
              paymentRequestId: paymentRequestIdRef.current,
            }),
          });
          const capture = await captureResponse.json();
          if (!captureResponse.ok || !capture.paid) {
            throw new Error(capture.error || "Paiement non finalisé.");
          }
          await onPaid();
        },
        onCancel() {
          setError("Paiement annulé. Aucun crédit n’a été ajouté.");
          void reportOutcome("cancelled");
        },
        onError(sdkError) {
          setError("PayPal n’a pas pu finaliser le paiement.");
          void reportOutcome(
            "error",
            sdkError instanceof Error ? sdkError.message : undefined,
          );
        },
      });
      await buttons.render(containerRef.current);
    }

    setup().catch(() => {
      setError("Le bouton PayPal n’a pas pu être chargé.");
      if (!automatedModeSelected) onMode("manual");
    });
    return () => {
      cancelled = true;
      buttons?.close?.().catch(() => undefined);
    };
  }, [onMode, onPaid]);

  return (
    <>
      <div ref={containerRef} className="mt-6 min-h-12" />
      {error && (
        <p className="mt-3 text-center text-[12px] font-bold text-red-600">
          {error}
        </p>
      )}
    </>
  );
}
