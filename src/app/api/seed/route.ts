import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/seed";

export async function POST() {
  seedDemoData();
  return NextResponse.json({ ok: true });
}
