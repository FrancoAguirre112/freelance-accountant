import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SkeletonCells } from "@/components/ui/skeleton-row";

const buttonVariants = [
  "default",
  "destructive",
  "outline",
  "secondary",
  "ghost",
  "link",
] as const;
const buttonSizes = ["default", "sm", "lg", "icon"] as const;
const badgeVariants = [
  "default",
  "secondary",
  "destructive",
  "outline",
] as const;

describe("Button snapshots", () => {
  for (const variant of buttonVariants) {
    it(`variant=${variant}`, () => {
      const { container } = render(
        <Button variant={variant}>Acción</Button>,
      );
      expect(container.firstChild).toMatchSnapshot();
    });
  }
  for (const size of buttonSizes) {
    it(`size=${size}`, () => {
      const { container } = render(<Button size={size}>A</Button>);
      expect(container.firstChild).toMatchSnapshot();
    });
  }
});

describe("Badge snapshots", () => {
  for (const variant of badgeVariants) {
    it(`variant=${variant}`, () => {
      const { container } = render(<Badge variant={variant}>Estado</Badge>);
      expect(container.firstChild).toMatchSnapshot();
    });
  }
});

describe("Input snapshot", () => {
  it("renders with placeholder", () => {
    const { container } = render(
      <Input placeholder="Buscar..." defaultValue="texto" />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("Progress snapshot", () => {
  it("renders at 60%", () => {
    const { container } = render(<Progress value={60} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("Card snapshot", () => {
  it("renders a composed card", () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Ingresos</CardTitle>
          <CardDescription>Mayo 2026</CardDescription>
        </CardHeader>
        <CardContent>$ 1.500</CardContent>
      </Card>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("SkeletonCells snapshot", () => {
  it("renders skeleton cells inside a row", () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <SkeletonCells widths={["w-20", "w-32"]} />
          </tr>
        </tbody>
      </table>,
    );
    expect(container.querySelector("tr")).toMatchSnapshot();
  });
});
