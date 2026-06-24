import { NextResponse } from "next/server";
import { getDailyTokenUsageRange } from "../../../../../../server/db/client";
import { ensureDb } from "../../_lib/ensure-db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isParsableDate(value: string): boolean {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json(
        { error: "Missing required query parameters 'from' and 'to'" },
        { status: 400 },
      );
    }
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || !isParsableDate(from) || !isParsableDate(to)) {
      return NextResponse.json(
        { error: "Invalid date format; expected YYYY-MM-DD" },
        { status: 400 },
      );
    }
    if (from > to) {
      return NextResponse.json(
        { error: "'from' must be less than or equal to 'to'" },
        { status: 400 },
      );
    }

    await ensureDb();
    const rows = getDailyTokenUsageRange(from, to);

    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[api/daily-token-usage/history] failed to fetch range:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}