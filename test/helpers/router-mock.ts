// Reusable next/navigation mock. Test files do:
//   vi.mock("next/navigation", async () =>
//     (await import("../helpers/router-mock")).navigationMock);
import { vi } from "vitest";

export const push = vi.fn();
export const replace = vi.fn();
export const refresh = vi.fn();

let params = new URLSearchParams();

export function setSearchParams(init: string | Record<string, string>) {
  params =
    typeof init === "string"
      ? new URLSearchParams(init)
      : new URLSearchParams(init);
}

export function resetRouterMock() {
  push.mockReset();
  replace.mockReset();
  refresh.mockReset();
  params = new URLSearchParams();
}

export const navigationMock = {
  useRouter: () => ({ push, replace, refresh, prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => params,
  usePathname: () => "/",
};
