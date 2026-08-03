import { NextResponse } from "next/server";
import {
  getPayPalPublicConfig,
  isPayPalConfigured,
} from "@/lib/paypal";

export async function GET() {
  if (!isPayPalConfigured()) {
    return NextResponse.json({ enabled: false });
  }

  const config = getPayPalPublicConfig();
  return NextResponse.json({
    enabled: true,
    clientId: config.clientId,
    environment: config.environment,
    currency: "EUR",
  });
}
