import { vi } from "vitest";

// Server actions call revalidatePath; it's a no-op in tests.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
