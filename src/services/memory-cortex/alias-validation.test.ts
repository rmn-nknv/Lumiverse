import { describe, expect, test } from "bun:test";

import { isPlausibleAlias, normalizeAliasKey } from "./alias-validation";

describe("normalizeAliasKey", () => {
  test("normalizes ASCII aliases", () => {
    expect(normalizeAliasKey("  The Iron Queen! ")).toBe("iron queen");
    expect(normalizeAliasKey("O’Brien")).toBe("o'brien");
  });

  test("keeps letters and digits of non-Latin scripts", () => {
    expect(normalizeAliasKey("Маша")).toBe("маша");
    expect(normalizeAliasKey("«Старый  Лис»")).toBe("старый лис");
    expect(normalizeAliasKey("Élodie")).toBe("élodie");
    expect(normalizeAliasKey("山田")).toBe("山田");
  });
});

describe("isPlausibleAlias with non-Latin scripts", () => {
  test("accepts Cyrillic name-like aliases", () => {
    expect(isPlausibleAlias("Маша", "Мария")).toBe(true);
    expect(isPlausibleAlias("Старый Лис", "Иван")).toBe(true);
    expect(isPlausibleAlias("Анна-Мария", "Анна")).toBe(true);
    expect(isPlausibleAlias("Élodie", "Elle")).toBe(true);
  });

  test("applies the same shape checks as for Latin aliases", () => {
    // same key as the canonical name
    expect(isPlausibleAlias("мария", "Мария")).toBe(false);
    // lowercase / not name-like
    expect(isPlausibleAlias("маша", "Мария")).toBe(false);
    expect(isPlausibleAlias("старый лис", "Иван")).toBe(false);
    // ALL-CAPS shouting
    expect(isPlausibleAlias("МАШЕНЬКА", "Мария")).toBe(false);
    // sentence-like
    expect(isPlausibleAlias("Маша пришла.", "Мария")).toBe(false);
  });

  test("accepts aliases from scripts without letter case", () => {
    expect(isPlausibleAlias("山田", "太郎")).toBe(true);
    expect(isPlausibleAlias("أبو علي", "محمد")).toBe(true);
  });
});
