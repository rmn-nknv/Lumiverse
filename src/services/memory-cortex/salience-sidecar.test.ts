import { describe, expect, test } from "bun:test";

import {
  extractBatchWithSidecar,
  getToolChoiceParams,
  parseToolCallResults,
} from "./salience-sidecar";

describe("getToolChoiceParams", () => {
  test("uses auto for Nano-GPT sidecars", () => {
    expect(getToolChoiceParams("nanogpt")).toEqual({ tool_choice: "auto" });
    expect(getToolChoiceParams("NanoGPT")).toEqual({ tool_choice: "auto" });
  });

  test("continues forcing tools for other OpenAI-compatible providers", () => {
    expect(getToolChoiceParams("openai")).toEqual({ tool_choice: "required" });
  });
});

describe("parseToolCallResults", () => {
  test("filters low-signal sidecar junk while preserving supported extraction", () => {
    const result = parseToolCallResults([
      {
        name: "score_salience",
        args: {
          importance: 7,
          emotional_tones: ["tension", "joy"],
          narrative_flags: ["discovery"],
          key_facts: ["betrayal", "Melina promised to return", "THE MOOD"],
        },
      },
      {
        name: "extract_entities",
        args: {
          entities: [
            { name: "Melina", type: "character", role: "subject" },
            { name: "Barely", type: "character" },
            { name: "The Pale", type: "location" },
          ],
          discovered_aliases: [
            { canonical_name: "Melina", alias: "Mel", evidence: "Call me Mel" },
            { canonical_name: "AI", alias: "Guide" },
            { canonical_name: "Melina", alias: "Personal cost", evidence: "called her personal cost" },
            { canonical_name: "Melina", alias: "Among the crowd", evidence: "known as among the crowd" },
            { canonical_name: "Melina", alias: "Guide" },
          ],
          status_changes: [
            { entity: "Melina", change: "arrived", detail: "Melina arrived in Dustwell" },
            { entity: "Personal", change: "injured", detail: "Invalid noise" },
          ],
        },
      },
      {
        name: "extract_relationships",
        args: {
          relationships: [
            { source: "Melina", target: "Kael", type: "ally", label: "trusted allies", sentiment: 0.8 },
            { source: "Strange", target: "Kael", type: "ally", label: "hallucinated pair" },
            { source: "Melina", target: "Melina", type: "ally", label: "self reference" },
          ],
        },
      },
      {
        name: "extract_font_colors",
        args: {
          color_attributions: [
            { hex_color: "#ff9999", character_name: "Melina", usage_type: "speech" },
            { hex_color: "#aaaaaa", character_name: "Personal", usage_type: "thought" },
          ],
        },
      },
    ]);

    expect(result.score).toBe(0.7);
    expect(result.keyFacts).toEqual(["Melina promised to return"]);
    expect(result.entitiesPresent.map((entity) => entity.name)).toEqual(["Melina", "The Pale"]);
    expect(result.discoveredAliases).toEqual([
      { canonicalName: "Melina", alias: "Mel", evidence: "Call me Mel" },
    ]);
    expect(result.statusChanges).toEqual([
      { entity: "Melina", change: "arrived", detail: "Melina arrived in Dustwell" },
    ]);
    expect(result.relationshipsShown).toEqual([
      { source: "Melina", target: "Kael", type: "ally", label: "trusted allies", sentiment: 0.8 },
    ]);
    expect(result.fontColors).toEqual([
      { hexColor: "#ff9999", characterName: "Melina", usageType: "speech" },
    ]);
  });
});

describe("parseToolCallResults with non-Latin scripts", () => {
  test("keeps Cyrillic sidecar output that passes the same checks as Latin text", () => {
    const result = parseToolCallResults([
      {
        name: "score_salience",
        args: {
          importance: 7,
          key_facts: [
            "Мария пообещала вернуться домой вечером",
            "Мария купила iPhone вчера вечером",
            "предательство раскрылось в полночь",
            "ТАЙНА РАСКРЫТА НАКОНЕЦ",
            "измена",
          ],
        },
      },
      {
        name: "extract_entities",
        args: {
          entities: [
            { name: "Мария", type: "character", role: "subject" },
            { name: "Старый Город", type: "location" },
            { name: "старый город", type: "location" },
            { name: "МАРИЯ", type: "character" },
          ],
          discovered_aliases: [
            { canonical_name: "Мария", alias: "Маша", evidence: "Зови меня Маша" },
          ],
          status_changes: [
            { entity: "Мария", change: "arrived", detail: "Мария вернулась в Старый Город" },
          ],
        },
      },
      {
        name: "extract_relationships",
        args: {
          relationships: [
            { source: "Мария", target: "Иван", type: "ally", label: "союзники", sentiment: 0.8 },
          ],
        },
      },
      {
        name: "extract_font_colors",
        args: {
          color_attributions: [
            { hex_color: "#FF9999", character_name: "Мария", usage_type: "speech" },
          ],
        },
      },
    ]);

    expect(result.keyFacts).toEqual([
      "Мария пообещала вернуться домой вечером",
      "Мария купила iPhone вчера вечером",
    ]);
    expect(result.entitiesPresent.map((entity) => entity.name)).toEqual(["Мария", "Старый Город"]);
    expect(result.discoveredAliases).toEqual([
      { canonicalName: "Мария", alias: "Маша", evidence: "Зови меня Маша" },
    ]);
    expect(result.statusChanges).toEqual([
      { entity: "Мария", change: "arrived", detail: "Мария вернулась в Старый Город" },
    ]);
    expect(result.relationshipsShown).toEqual([
      { source: "Мария", target: "Иван", type: "ally", label: "союзники", sentiment: 0.8 },
    ]);
    expect(result.fontColors).toEqual([
      { hexColor: "#ff9999", characterName: "Мария", usageType: "speech" },
    ]);
  });

  test("still requires an English verb in Latin-only facts", () => {
    const result = parseToolCallResults([
      {
        name: "score_salience",
        args: { key_facts: ["Melina of the Pale Court", "Melina rules the Pale Court"] },
      },
    ]);

    expect(result.keyFacts).toEqual(["Melina rules the Pale Court"]);
  });

  test("accepts multi-word entity names from scripts without letter case", () => {
    const result = parseToolCallResults([
      {
        name: "extract_entities",
        args: { entities: [{ name: "山田 太郎", type: "character" }, { name: "محمد علي", type: "character" }] },
      },
    ]);

    expect(result.entitiesPresent.map((entity) => entity.name)).toEqual(["山田 太郎", "محمد علي"]);
  });
});

describe("extractBatchWithSidecar", () => {
  test("ignores sparse tool-call entries from a provider", async () => {
    const result = await extractBatchWithSidecar([
      { index: 0, content: "Mara found the missing map." },
    ], async () => ({
      content: "",
      tool_calls: [
        undefined as never,
        {
          name: "analyze_passage_batch",
          args: {
            results: [{
              index: 0,
              importance: 5,
              emotional_tones: [],
              narrative_flags: [],
              key_facts: [],
              entities_present: [],
              relationships_shown: [],
              status_changes: [],
              color_attributions: [],
              discovered_aliases: [],
            }],
          },
        },
      ],
    }), "sidecar-test");

    expect(result[0]?.score).toBe(0.5);
  });

  test("uses one structured batch tool call and maps results by passage index", async () => {
    let toolNames: string[] = [];
    const result = await extractBatchWithSidecar([
      { index: 0, content: "Mara found the missing map." },
      { index: 1, content: "Tovin admitted selling it." },
    ], async (options) => {
      toolNames = (options.tools ?? []).map((tool) => tool.name);
      return {
        content: "",
        tool_calls: [{
          name: "analyze_passage_batch",
          args: {
            results: [
              {
                index: 1,
                importance: 7,
                emotional_tones: ["tension"],
                narrative_flags: ["confession"],
                key_facts: ["Tovin admitted he sold the missing map"],
                entities_present: [{ name: "Tovin", type: "character", role: "subject" }],
                relationships_shown: [],
                status_changes: [],
                color_attributions: [],
                discovered_aliases: [],
              },
              {
                index: 0,
                importance: 5,
                emotional_tones: [],
                narrative_flags: ["discovery"],
                key_facts: ["Mara discovered that the map was missing"],
                entities_present: [{ name: "Mara", type: "character", role: "subject" }],
                relationships_shown: [],
                status_changes: [],
                color_attributions: [],
                discovered_aliases: [],
              },
            ],
          },
        }],
      };
    }, "sidecar-test");

    expect(toolNames).toEqual(["analyze_passage_batch"]);
    expect(result.map((entry) => entry?.score)).toEqual([0.5, 0.7]);
    expect(result[0]?.entitiesPresent[0]?.name).toBe("Mara");
    expect(result[1]?.entitiesPresent[0]?.name).toBe("Tovin");
  });
});
