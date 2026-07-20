import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ACTUAL_FIELDS = [
  "source_image", "confidence", "is_low_confidence", "initial_exam_room", "return_room",
  "sequence", "room_code", "room_name", "description", "note", "queue_number",
] as const;
const COMMON_FIELDS = [
  "initial_exam_room", "return_room", "sequence", "room_code", "queue_number",
] as const;
type ActualField = (typeof ACTUAL_FIELDS)[number];
type CommonField = (typeof COMMON_FIELDS)[number];
type ActualRow = Record<ActualField, string>;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (quoted && next === '"') { cell += '"'; index += 1; } else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

async function findRepoFile(...parts: string[]): Promise<string> {
  const candidates = [path.resolve(process.cwd(), "..", "..", ...parts), path.resolve(process.cwd(), ...parts)];
  for (const candidate of candidates) {
    try { await readFile(candidate); return candidate; } catch { /* try next layout */ }
  }
  throw new Error(`File not found: ${parts.join("/")}`);
}

function readRows(text: string, fields: readonly string[]): Array<Record<string, string>> {
  const parsed = parseCsv(text.replace(/^\uFEFF/, ""));
  const headers = parsed[0] ?? [];
  const indexes = new Map(headers.map((header, index) => [header, index]));
  return parsed.slice(1).map((values) => Object.fromEntries(
    fields.map((field) => [field, values[indexes.get(field) ?? -1] ?? ""]),
  ));
}

function formKey(source: string): string {
  return source.match(/phieu\s*(\d+)/i)?.[1] ?? source;
}

export async function GET() {
  try {
    const actualPath = await findRepoFile("data", "generated", "ocr_results", "ketquatest.csv");
    const expectedPath = await findRepoFile("data", "generated", "ocr_results", "test.csv");
    const [actualText, expectedText] = await Promise.all([readFile(actualPath, "utf8"), readFile(expectedPath, "utf8")]);
    const actualRows = readRows(actualText, ACTUAL_FIELDS) as ActualRow[];
    const expectedRows = readRows(expectedText, ["source_image", ...COMMON_FIELDS]) as Array<
      { source_image: string } & Record<CommonField, string>
    >;
    const expectedByFormAndSequence = new Map<string, Record<CommonField, string>>();
    for (const row of expectedRows) expectedByFormAndSequence.set(`${formKey(row.source_image)}:${row.sequence}`, row);

    const rows = actualRows.map((actual, index) => {
      const expected = expectedByFormAndSequence.get(`${formKey(actual.source_image)}:${actual.sequence}`);
      const result = expected ? COMMON_FIELDS.every((field) => actual[field] === expected[field]) : false;
      return {
        id: index + 1,
        source_image: actual.source_image,
        confidence: Number(actual.confidence) || 0,
        initial_exam_room: actual.initial_exam_room,
        return_room: actual.return_room,
        sequence: actual.sequence,
        room_code: actual.room_code,
        room_name: actual.room_name,
        queue_number: actual.queue_number,
        result: result ? "PASS" : "FAIL",
        result_reason: result ? "Common columns match test.csv" : "One or more common columns differ from test.csv",
      };
    });
    const passedLines = rows.filter((row) => row.result === "PASS").length;
    const formResults = new Map<string, boolean>();
    for (const row of rows) {
      const key = formKey(row.source_image);
      formResults.set(key, (formResults.get(key) ?? true) && row.result === "PASS");
    }
    const passedForms = [...formResults.values()].filter(Boolean).length;
    return NextResponse.json({
      source: "data/generated/ocr_results/ketquatest.csv vs test.csv",
      benchmark_note: "Mỗi dòng của ketquatest.csv là một dòng benchmark; source_image được ghép theo số phiếu, bỏ qua description và note.",
      summary: {
        total_forms: formResults.size,
        pass_forms: passedForms,
        total_lines: rows.length,
        pass_lines: passedLines,
        pass_rate: rows.length ? passedLines / rows.length : 0,
      },
      rows,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load OCR benchmark" }, { status: 500 });
  }
}
