import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render";
import { ThemeToggle } from "@/components/theme-toggle";

describe("<ThemeToggle />", () => {
  it("renders a theme button with accessible label", () => {
    renderWithProviders(<ThemeToggle />);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("Cambiar tema")).toBeInTheDocument();
  });

  it("toggles the document theme class on click", async () => {
    const { user } = renderWithProviders(<ThemeToggle />);
    // Provider defaultTheme is "dark"
    await user.click(screen.getByRole("button"));
    expect(document.documentElement.classList.contains("light")).toBe(true);
    await user.click(screen.getByRole("button"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
