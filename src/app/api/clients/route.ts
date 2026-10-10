import { NextResponse } from "next/server";
import { listClients } from "@/lib/db/repo";

export async function GET() {
  return NextResponse.json({ clients: listClients() });
}
