// Daily cron endpoint. Hit this once a day (Vercel Cron / GitHub Actions /
// cron-job.org / n8n / etc) with `Authorization: Bearer <CRON_SECRET>`. It
// iterates every user with a Slack webhook configured and posts a summary
// for recurring services whose billingDay matches today.
import { NextResponse } from "next/server";
import { sendRemindersForAllUsers } from "@/app/actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 500 },
    );
  }

  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date();
  // Allow an explicit `?date=YYYY-MM-DD` override for backfills / testing.
  const url = new URL(req.url);
  const dateOverride = url.searchParams.get("date");
  const runDate = dateOverride
    ? new Date(dateOverride + "T12:00:00Z")
    : today;

  const summary = await sendRemindersForAllUsers(runDate);
  return NextResponse.json(summary);
}
