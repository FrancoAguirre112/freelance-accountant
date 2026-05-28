// Test-only auth shim. Strictly inert in production: every code path is
// gated on the E2E_TEST_MODE env var, which is only set by the Playwright
// webServer. When unset, isE2E() is false and the real NextAuth flow runs.

export const TEST_USER = {
  id: "e2e-user",
  name: "E2E Tester",
  email: "e2e@example.com",
  profileType: "programador" as const,
};

export function isE2E(): boolean {
  return process.env.E2E_TEST_MODE === "1";
}

export function getTestSession() {
  return {
    user: {
      id: TEST_USER.id,
      name: TEST_USER.name,
      email: TEST_USER.email,
      profileType: TEST_USER.profileType,
    },
  };
}
