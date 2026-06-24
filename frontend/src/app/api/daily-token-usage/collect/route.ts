import { NextResponse } from "next/server";
import { collectAndStoreDailyTokenUsage } from "../../../../../../server/lib/daily-token-usage/collector";
import { ensureDb } from "../../_lib/ensure-db";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    await ensureDb();

    let targetDate: string | undefined;
    try {
      const body = (await request.json().catch(() => null)) as { date?: string } | null;
      targetDate = body?.date;
    } catch {
      targetDate = undefined;
    }

    const result = await collectAndStoreDailyTokenUsage(targetDate);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          date: result.date,
          errors: result.errors,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[api/daily-token-usage/collect] failed to collect daily token usage:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Collection failed", message },
      { status: 500 },
    );
  }
}