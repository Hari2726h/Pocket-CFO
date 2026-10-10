import { NextResponse } from "next/server";
import { listInvoices } from "@/lib/db/repo";

export async function GET() {
  return NextResponse.json({ invoices: listInvoices() });
}
