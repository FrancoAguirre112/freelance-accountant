import Image from "next/image";
import Link from "next/link";
import { Montserrat } from "next/font/google";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const montserrat = Montserrat({ subsets: ["latin"], weight: "900" });

interface Step {
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Crear una app de Slack",
    body: (
      <>
        <p>
          Andá a{" "}
          <a
            href="https://api.slack.com/apps?new_app=1"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            api.slack.com/apps
            <ExternalLink className="inline w-3 h-3 ml-0.5" />
          </a>{" "}
          y hacé clic en <strong>Create New App → From scratch</strong>.
        </p>
        <p>
          Ponele un nombre (algo como <em>Fiscus Recordatorios</em>) y elegí el{" "}
          <strong>workspace</strong> donde querés que te llegue el mensaje.
        </p>
      </>
    ),
  },
  {
    title: "Activar Incoming Webhooks",
    body: (
      <>
        <p>
          Una vez creada la app, en el menú lateral entrá a{" "}
          <strong>Incoming Webhooks</strong> y pasá el switch a{" "}
          <strong>On</strong>.
        </p>
        <p className="text-muted-foreground text-sm">
          Slack te muestra una pantalla con explicaciones — podés ignorarlas e
          ir directo al paso siguiente.
        </p>
      </>
    ),
  },
  {
    title: "Agregar un webhook a un canal",
    body: (
      <>
        <p>
          Al final de esa misma pantalla, clic en{" "}
          <strong>Add New Webhook to Workspace</strong>. Slack te va a pedir que
          elijas un canal — ese es el que va a recibir los recordatorios diarios.
        </p>
        <p className="text-muted-foreground text-sm">
          Recomendado: un canal personal tuyo (ej. <code className="px-1 py-0.5 bg-muted rounded text-xs">#fiscus</code>{" "}
          o un DM contigo mismo).
        </p>
      </>
    ),
  },
  {
    title: "Copiar la URL del webhook",
    body: (
      <>
        <p>
          Slack te devuelve a la pantalla de Incoming Webhooks con una fila
          nueva. Hacé clic en <strong>Copy</strong> al lado de la URL.
        </p>
        <div className="mt-2 p-3 bg-muted/60 border rounded-md text-xs font-mono break-all text-muted-foreground">
          https://hooks.slack.com/services/T0000/B0000/XXXXXXXXXXXXX
        </div>
        <p className="mt-2 text-muted-foreground text-sm">
          Esa URL es secreta — tratala como una contraseña.
        </p>
      </>
    ),
  },
  {
    title: "Pegarla en Fiscus",
    body: (
      <>
        <p>
          Volvé al dashboard, abrí <strong>Ajustes</strong> (rueda dentada
          arriba a la derecha) y pegá la URL en el campo{" "}
          <em>Webhook de Slack para recordatorios</em>.
        </p>
        <p>
          Hacé clic en <strong>Guardar</strong>, después en{" "}
          <strong>Enviar prueba</strong>. Si todo está bien, vas a recibir un
          mensaje en el canal (o un toast diciendo que no hay recurrentes por
          recordar hoy — eso también significa que el webhook funciona).
        </p>
      </>
    ),
  },
];

export default function SlackWebhookHelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 pl-2">
            <Link href="/">
              <ArrowLeft className="w-4 h-4" />
              Volver al dashboard
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <Image
            src="/Flogo.webp"
            alt="Logo"
            width={40}
            height={40}
            className="w-10 h-10"
          />
          <h1
            className={`${montserrat.className} text-3xl md:text-4xl tracking-tight`}
          >
            Fiscus
          </h1>
        </div>
        <h2 className="text-xl md:text-2xl font-semibold mt-6">
          Configurar recordatorios en Slack
        </h2>
        <p className="mt-2 text-muted-foreground">
          Necesitás un <strong>Incoming Webhook URL</strong> de Slack. Es una
          URL secreta que recibe mensajes y los publica en un canal. Es gratis
          y tarda dos minutos en obtenerla.
        </p>

        <Card className="mt-6 bg-muted/30 border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="w-4 h-4" />
              ¿Qué te va a llegar?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1.5">
            <p>
              Un mensaje cada día en el canal que elijas, solo cuando haya
              recurrentes pendientes: <em>día de cobro = hoy</em> y todavía no
              se registró el pago/cobro del mes.
            </p>
            <p>Si no hay nada pendiente, no llega nada — silencio total.</p>
          </CardContent>
        </Card>

        <ol className="mt-8 space-y-6">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                {i + 1}
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold leading-tight">{step.title}</h3>
                <div className="space-y-2 text-sm leading-relaxed">
                  {step.body}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <Card className="mt-10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4" /> Seguridad
            </CardTitle>
            <CardDescription>
              Buenas prácticas para tu webhook.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
              No pegues la URL en chats públicos ni la subas a GitHub.
            </p>
            <p className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
              Si pensás que se filtró, andá a{" "}
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                la app en Slack
              </a>{" "}
              y regenerala (borrá el webhook y agregá uno nuevo).
            </p>
            <p className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
              En cualquier momento podés borrar la URL desde Ajustes para
              cortar los avisos.
            </p>
          </CardContent>
        </Card>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Button asChild className="gap-2">
            <Link href="/">
              <Copy className="w-4 h-4" />
              Ya tengo la URL — abrir Ajustes
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4" />
              Docs oficiales de Slack
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
