import { NextResponse } from "next/server";
import { readBinary, GitHubError } from "@/lib/github";
import { log, errMessage } from "@/lib/log";

const VALID_GARDENS = ["ai", "world", "culture", "misc"];
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

// Serve an image attachment out of the private repo. The path is validated to
// live under "<garden>/attachments/" and end in an image extension, so this
// can't be used to exfiltrate arbitrary repo files (e.g. notes or config).
export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path")?.trim();
  if (!path) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }

  const segments = path.split("/");
  const looksSafe =
    !path.includes("..") &&
    VALID_GARDENS.includes(segments[0]) &&
    segments.includes("attachments") &&
    IMAGE_EXT.test(path);

  if (!looksSafe) {
    log.warn("image", `rejected path "${path}"`);
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  try {
    const { bytes, contentType } = await readBinary(path);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        // Attachments are content-addressed by name; cache hard.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    log.error("image", `load failed for "${path}": ${errMessage(e)}`);
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}
