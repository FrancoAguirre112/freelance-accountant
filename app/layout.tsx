import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { UpdateNotification } from "@/components/update-notification";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "next-auth/react";
import { PerformanceProvider } from "@/components/performance-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fiscus",
  description: "Gestión de ingresos y proyectos",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProvider>
          <ThemeProvider>
            <PerformanceProvider>
              <main>{children}</main>
              <Toaster position="top-center" richColors />
              <UpdateNotification />
            </PerformanceProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
