import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const IMAGE_PATTERN = /^phieu\s*\d+\.(png|jpe?g)$/i;

async function findImage(filename: string): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "..", "..", "data", "reference", "phieukham", filename),
    path.resolve(process.cwd(), "data", "reference", "phieukham", filename),
  ];
  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      // Try the next known workspace layout.
    }
  }
  throw new Error("Image not found");
}

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("source") ?? "";
  const filename = path.basename(source);
  if (!IMAGE_PATTERN.test(filename)) {
    return NextResponse.json({ error: "Invalid benchmark image" }, { status: 400 });
  }

  try {
    const imagePath = await findImage(filename);
    const bytes = await readFile(imagePath);
    const extension = path.extname(filename).toLowerCase();
    const contentType = extension === ".png" ? "image/png" : "image/jpeg";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Benchmark image not found" }, { status: 404 });
  }
}
