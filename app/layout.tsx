import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // <--- ESTA ES LA LÍNEA QUE FALTA
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Freelance Dashboard",
  description: "Gestión de ingresos y proyectos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <main>{children}</main>
        {/* Notificaciones modernas con Sonner */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
