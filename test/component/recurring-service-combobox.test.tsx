import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render";
import { RecurringServiceCombobox } from "@/components/recurring-service-combobox";

const services = [
  { id: 5, name: "Hosting" },
  { id: 6, name: "Mantenimiento" },
];

describe("<RecurringServiceCombobox />", () => {
  it("selects a service and writes its id", async () => {
    const { container, user } = renderWithProviders(
      <RecurringServiceCombobox services={services} name="serviceId" />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Hosting"));

    const hidden = container.querySelector(
      'input[name="serviceId"]',
    ) as HTMLInputElement;
    expect(hidden.value).toBe("5");
    expect(screen.getByRole("combobox")).toHaveTextContent("Hosting");
  });

  it("shows the placeholder until something is picked", () => {
    renderWithProviders(<RecurringServiceCombobox services={services} />);
    expect(screen.getByText("Buscar servicio/abono...")).toBeInTheDocument();
  });
});
