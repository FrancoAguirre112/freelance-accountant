import * as React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/theme-provider";
import { PerformanceProvider } from "@/components/performance-context";

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PerformanceProvider>{children}</PerformanceProvider>
    </ThemeProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Providers, ...options }),
  };
}

export * from "@testing-library/react";
