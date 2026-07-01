import { NextResponse } from "next/server";
import { getRefreshRunState, getNormalizedSnapshot } from "../../../../../server/db/client";
import { buildDiagnostics } from "../../../../../server/lib/build-diagnostics";
import { getShowPrivateRepoItems } from "../../../../../server/lib/runtime-config";
import { ensureDb } from "../_lib/ensure-db";

export async function GET() {
  try {
    await ensureDb();
    const body = buildDiagnostics(getRefreshRunState(), getNormalizedSnapshot(), getShowPrivateRepoItems());
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[api/diagnostics] failed to build diagnostics response:", error);
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }
}
