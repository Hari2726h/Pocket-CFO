import { NextResponse } from "next/server";
import { listActivity } from "@/lib/db/repo";

export async function GET() {
  return NextResponse.json({ activity: listActivity() });
}
