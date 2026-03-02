"use client";

import { useRouter } from "next/navigation";
import { setProfileTypeAction } from "@/app/actions";
import Image from "next/image";
import { Montserrat } from "next/font/google";
import { Code2, Megaphone } from "lucide-react";

const montserrat = Montserrat({ subsets: ["latin"], weight: "900" });

export default function OnboardingPage() {
  const router = useRouter();

  async function selectProfile(type: "programador" | "marketing") {
    await setProfileTypeAction(type);
    router.push("/");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-8 p-8 max-w-lg w-full">
        <div className="flex items-center gap-3">
          <Image src="/Flogo.webp" alt="Logo" width={40} height={40} />
          <h1 className={`${montserrat.className} text-3xl tracking-tight`}>
            Fiscus
          </h1>
        </div>
        <p className="text-muted-foreground text-center">
          Selecciona tu tipo de perfil para comenzar
        </p>

        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            onClick={() => selectProfile("programador")}
            className="flex flex-col items-center gap-4 p-6 bg-card border rounded-lg hover:border-primary hover:shadow-md transition-all cursor-pointer"
          >
            <Code2 className="w-10 h-10 text-blue-600" />
            <span className="font-semibold">Programador</span>
            <span className="text-xs text-muted-foreground text-center">
              Desarrollo de software y proyectos web
            </span>
          </button>

          <button
            onClick={() => selectProfile("marketing")}
            className="flex flex-col items-center gap-4 p-6 bg-card border rounded-lg hover:border-primary hover:shadow-md transition-all cursor-pointer"
          >
            <Megaphone className="w-10 h-10 text-purple-600" />
            <span className="font-semibold">Marketing</span>
            <span className="text-xs text-muted-foreground text-center">
              Campañas, contenido y servicios digitales
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
