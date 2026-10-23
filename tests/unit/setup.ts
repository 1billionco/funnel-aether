// "server-only" throws outside a React Server environment; unit tests import
// server modules directly, so stub it.
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
