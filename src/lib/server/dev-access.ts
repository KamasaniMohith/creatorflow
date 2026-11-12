import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "creatorflow_dev_access";

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function isLocalDevelopmentRequest(request: Request): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const url = new URL(request.url);
  return isLocalHostname(url.hostname);
}

export function isSameOriginLocalRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || !isLocalDevelopmentRequest(request)) return false;
  try {
    const parsedOrigin = new URL(origin);
    return (
      isLocalHostname(parsedOrigin.hostname) &&
      parsedOrigin.host === new URL(request.url).host
    );
  } catch {
    return false;
  }
}

function constantTimeEqual(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

export function canUnlockDevelopmentAccess(request: Request): boolean {
  return isSameOriginLocalRequest(request);
}

export function isDevelopmentAccessUnlocked(request: NextRequest): boolean {
  const expected = process.env.OUTREACH_DEV_TOKEN;
  const provided = request.cookies.get(COOKIE_NAME)?.value;
  return Boolean(
    expected &&
      provided &&
      isLocalDevelopmentRequest(request) &&
      constantTimeEqual(provided, expected),
  );
}

export function accessCookieName(): string {
  return COOKIE_NAME;
}

export function devTokenMatches(candidate: unknown): candidate is string {
  const expected = process.env.OUTREACH_DEV_TOKEN;
  return (
    typeof candidate === "string" &&
    candidate.length >= 16 &&
    candidate.length <= 256 &&
    Boolean(expected && constantTimeEqual(candidate, expected))
  );
}
