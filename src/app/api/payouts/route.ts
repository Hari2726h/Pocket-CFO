import { NextResponse } from "next/server";
import { listPayouts } from "@/lib/db/repo";

export async function GET() {
  return NextResponse.json({ payouts: listPayouts() });
}
