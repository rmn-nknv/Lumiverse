import { describe, expect, test } from "bun:test";

import { buildProtectedLineEntities, getDefaultEntityExtractionFilters } from "./entity-extraction-filters";

describe("buildProtectedLineEntities", () => {
  test("keeps protected candidates in non-Latin scripts", () => {
    const filters = getDefaultEntityExtractionFilters();
    filters.location.protectedTerms = ["Город", "City"];

    const entities = buildProtectedLineEntities("Старый Город\nOld City\n---", filters);

    expect(entities.map((entity) => entity.name)).toEqual(["Старый Город", "Old City"]);
  });
});
