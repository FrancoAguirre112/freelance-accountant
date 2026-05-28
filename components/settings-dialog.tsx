"use client";

import * as React from "react";
import Link from "next/link";
import { HelpCircle, Loader2, Send, Settings } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { usePerformance } from "@/components/performance-context";
import {
  sendRecurringRemindersAction,
  setSlackWebhookAction,
} from "@/app/actions";

interface SettingsDialogProps {
  slackWebhookUrl?: string | null;
}

export function SettingsDialog({ slackWebhookUrl = null }: SettingsDialogProps) {
  const { performanceMode, setPerformanceMode } = usePerformance();
  const [savedWebhook, setSavedWebhook] = React.useState(slackWebhookUrl ?? "");
  const [webhook, setWebhook] = React.useState(slackWebhookUrl ?? "");
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const dirty = webhook.trim() !== savedWebhook.trim();

  async function saveWebhook() {
    setSaving(true);
    try {
      const trimmed = webhook.trim();
      const res = await setSlackWebhookAction(trimmed || null);
      if (res.success) {
        setSavedWebhook(trimmed);
        toast.success(
          trimmed ? "Webhook de Slack guardado" : "Webhook de Slack eliminado",
        );
      }
    } catch (err) {
      toast.error("No se pudo guardar el webhook", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res = await sendRecurringRemindersAction();
      if (res.sent) {
        toast.success(`Enviado: ${res.due.length} recordatorio(s).`);
      } else if (res.reason === "no_webhook_configured") {
        toast.error("Guardá un webhook antes de probar.");
      } else {
        toast.info("Sin recurrentes por recordar hoy.");
      }
    } catch (err) {
      toast.error("Slack rechazó el mensaje", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Ajustes</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Ajustes</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="performance-mode" className="text-sm font-medium">
                Modo Rendimiento
              </Label>
              <p className="text-xs text-muted-foreground">
                Desactiva animaciones para una experiencia más rápida
              </p>
            </div>
            <Switch
              id="performance-mode"
              checked={performanceMode}
              onCheckedChange={setPerformanceMode}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="slack-webhook" className="text-sm font-medium">
                Webhook de Slack para recordatorios
              </Label>
              <Link
                href="/help/slack-webhook"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                <HelpCircle className="w-3 h-3" />
                ¿Cómo lo obtengo?
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Pegá una <strong>Incoming Webhook URL</strong> de Slack. El cron
              diario te avisa cuando un recurrente vence (día de cobro = hoy
              y no se registró todavía).
            </p>
            <Input
              id="slack-webhook"
              type="url"
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              autoComplete="off"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={saveWebhook}
                disabled={!dirty || saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Guardar"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={sendTest}
                disabled={testing || !savedWebhook.trim() || dirty}
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-1 w-3 h-3" /> Enviar prueba
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
