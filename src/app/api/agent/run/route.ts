import { NextResponse } from "next/server";
import { runAgentCycle } from "@/lib/agent/orchestrator";

export async function POST() {
  try {
    const summary = await runAgentCycle();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[api/agent/run] failed:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
