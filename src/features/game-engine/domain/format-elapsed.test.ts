import { describe, expect, it } from "vitest";
import { formatElapsed } from "./format-elapsed";

describe("formatElapsed", () => {
  it.each([
    [0, "0:00"],
    [5_000, "0:05"],
    [65_000, "1:05"],
    [600_000, "10:00"],
  ])("formatea %i ms como %s", (ms, expected) => {
    expect(formatElapsed(ms)).toBe(expected);
  });
});
