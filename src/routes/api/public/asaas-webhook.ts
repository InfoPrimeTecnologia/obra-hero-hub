import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AsaasWebhookEvent = {
  event: string;
  payment?: {
    id: string;
    subscription?: string;
    customer?: string;
    value?: number;
    netValue?: number;
    status?: string;
    dueDate?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    billingType?: string;
    description?: string;
    externalReference?: string;
  };
};

type InvoiceStatus = "pending" | "paid" | "overdue" | "canceled" | "refunded";
type PayMethod = "boleto" | "credit_card" | "pix" | "transfer" | "undefined";

function mapStatus(s?: string): InvoiceStatus {
  switch (s) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "paid";
    case "OVERDUE":
      return "overdue";
    case "REFUNDED":
    case "REFUND_REQUESTED":
      return "refunded";
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
      return "canceled";
    case "PENDING":
    case "AWAITING_RISK_ANALYSIS":
      return "pending";
    default:
      return "pending";
  }
}

function mapMethod(s?: string): PayMethod {
  switch (s) {
    case "BOLETO":
      return "boleto";
    case "PIX":
      return "pix";
    case "CREDIT_CARD":
      return "credit_card";
    default:
      return "undefined";
  }
}

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ASAAS_WEBHOOK_TOKEN;
        const provided =
          request.headers.get("asaas-access-token") ??
          request.headers.get("Asaas-Access-Token") ??
          "";
        if (expected && provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: AsaasWebhookEvent;
        try {
          body = (await request.json()) as AsaasWebhookEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // Log event
        const { data: logged } = await supabaseAdmin
          .from("webhook_events")
          .insert({
            provider: "asaas",
            event_type: body.event,
            external_id: body.payment?.id ?? null,
            payload: body as never,
          })
          .select("id")
          .single();

        try {
          const pay = body.payment;
          if (!pay?.id) {
            return Response.json({ ok: true, ignored: "no payment" });
          }

          // Find invoice by asaas_payment_id or by externalReference (invoice id)
          let { data: inv } = await supabaseAdmin
            .from("invoices")
            .select("*")
            .eq("asaas_payment_id", pay.id)
            .maybeSingle();

          if (!inv && pay.externalReference) {
            const { data: byExt } = await supabaseAdmin
              .from("invoices")
              .select("*")
              .eq("id", pay.externalReference)
              .maybeSingle();
            inv = byExt;
          }

          // Subscription-generated payment: create invoice if missing
          if (!inv && pay.subscription) {
            const { data: sub } = await supabaseAdmin
              .from("subscriptions")
              .select("id, customer_id")
              .eq("asaas_subscription_id", pay.subscription)
              .maybeSingle();
            if (sub) {
              const { data: created } = await supabaseAdmin
                .from("invoices")
                .insert({
                  customer_id: sub.customer_id,
                  subscription_id: sub.id,
                  description: pay.description ?? "Mensalidade",
                  amount: pay.value ?? 0,
                  status: mapStatus(pay.status),
                  payment_method: mapMethod(pay.billingType),
                  due_date: pay.dueDate ?? new Date().toISOString().slice(0, 10),
                  asaas_payment_id: pay.id,
                  invoice_url: pay.invoiceUrl ?? null,
                  bank_slip_url: pay.bankSlipUrl ?? null,
                  payment_link: pay.invoiceUrl ?? null,
                })
                .select("*")
                .single();
              inv = created;
            }
          }

          if (inv) {
            const status = mapStatus(pay.status);
            await supabaseAdmin
              .from("invoices")
              .update({
                status,
                payment_method: mapMethod(pay.billingType),
                invoice_url: pay.invoiceUrl ?? inv.invoice_url,
                bank_slip_url: pay.bankSlipUrl ?? inv.bank_slip_url,
                payment_link: pay.invoiceUrl ?? inv.payment_link,
                asaas_payment_id: pay.id,
                paid_at:
                  status === "paid"
                    ? new Date(
                        pay.paymentDate ?? pay.clientPaymentDate ?? Date.now(),
                      ).toISOString()
                    : null,
              })
              .eq("id", inv.id);
          }

          if (logged?.id) {
            await supabaseAdmin
              .from("webhook_events")
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq("id", logged.id);
          }

          return Response.json({ ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (logged?.id) {
            await supabaseAdmin
              .from("webhook_events")
              .update({ error: msg })
              .eq("id", logged.id);
          }
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
