// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseSearch } from "@/components/tab-search";

const prefixes = [
  { key: "e", label: "Entidad" },
  { key: "d", label: "Descripción" },
  { key: "m", label: "Monto" },
];

describe("parseSearch", () => {
  it("returns the default field when no prefix matches", () => {
    expect(parseSearch("acme corp", prefixes)).toEqual({
      field: "default",
      term: "acme corp",
    });
  });

  it("extracts the field and term for a known prefix", () => {
    expect(parseSearch("e:Mermoz", prefixes)).toEqual({
      field: "e",
      term: "Mermoz",
    });
  });

  it("is case-insensitive on the prefix and trims the term", () => {
    expect(parseSearch("  D:  hello world  ", prefixes)).toEqual({
      field: "d",
      term: "hello world",
    });
  });

  it("handles an empty query", () => {
    expect(parseSearch("", prefixes)).toEqual({ field: "default", term: "" });
  });

  it("treats an unknown prefix as default text", () => {
    expect(parseSearch("x:value", prefixes)).toEqual({
      field: "default",
      term: "x:value",
    });
  });

  it("returns an empty term when only the prefix is typed", () => {
    expect(parseSearch("m:", prefixes)).toEqual({ field: "m", term: "" });
  });
});
