import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render";
import { SyncedTabs } from "@/components/synced-tabs";
import { ActiveTabProvider } from "@/components/active-tab-context";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function Harness() {
  return (
    <ActiveTabProvider>
      <SyncedTabs>
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="transactions">Movimientos</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">OVERVIEW PANEL</TabsContent>
        <TabsContent value="transactions">TXN PANEL</TabsContent>
      </SyncedTabs>
    </ActiveTabProvider>
  );
}

describe("<SyncedTabs />", () => {
  it("defaults to the overview panel", () => {
    renderWithProviders(<Harness />);
    expect(screen.getByText("OVERVIEW PANEL")).toBeVisible();
  });

  it("switches the active panel when another tab is selected", async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Movimientos" }));
    expect(screen.getByText("TXN PANEL")).toBeVisible();
  });
});
