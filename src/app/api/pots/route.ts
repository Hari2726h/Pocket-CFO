import { NextResponse } from "next/server";
import { listPots } from "@/lib/db/repo";

export async function GET() {
  return NextResponse.json({ pots: listPots() });
}
