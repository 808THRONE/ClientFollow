/**
 * Gmail OAuth and Cloud Pub/Sub Integration Service
 * Handles OAuth2 consent flow, token exchange/refresh, outbound email dispatch,
 * and incoming Gmail push notification decoding.
 */
import { CircuitBreaker } from "@/lib/circuit-breaker";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const gmailCircuitBreaker = new CircuitBreaker({
  name: "GmailRESTAPI",
  failureThreshold: 3,
  recoveryTimeoutMs: 30_000,
  timeoutMs: 10_000,
});

export interface GoogleAuthOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string[];
}

export interface PubSubNotification {
  emailAddress: string;
  historyId: string;
}

const DEFAULT_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/gmail.modify",
];

/**
 * Generates Google OAuth consent URL for Gmail integration
 */
export function generateGoogleAuthUrl(options: GoogleAuthOptions): string {
  const { clientId, redirectUri, state, scope = DEFAULT_GMAIL_SCOPES } = options;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scope.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges Google OAuth authorization code for access and refresh tokens.
 */
export async function exchangeGoogleAuthCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  if (!code || !clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing required parameters for Google OAuth token exchange");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token exchange failed (HTTP ${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refreshes an expired Google access token using an offline refresh token.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; expiresIn: number }> {
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error("Missing required parameters for Google token refresh");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }).toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token refresh failed (HTTP ${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Sends a live email message via the Google Gmail REST API.
 */
export async function sendGmailMessage(
  accessToken: string,
  params: {
    to: string;
    subject: string;
    body: string;
    threadId?: string;
  }
): Promise<{ messageId: string; threadId?: string }> {
  if (!accessToken) {
    throw new Error("Access token is required to send Gmail message");
  }

  const utf8Subject = `=?utf-8?B?${Buffer.from(params.subject).toString("base64")}?=`;
  const messageParts = [
    `To: ${params.to}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${utf8Subject}`,
    "",
    params.body,
  ];

  const rawMessage = Buffer.from(messageParts.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const bodyPayload: { raw: string; threadId?: string } = { raw: rawMessage };
  if (params.threadId) {
    bodyPayload.threadId = params.threadId;
  }

  const executeCall = async () => {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail API send failed (HTTP ${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
      messageId: data.id,
      threadId: data.threadId,
    };
  };

  if (isFeatureEnabled("circuit_breaker_enabled")) {
    return gmailCircuitBreaker.execute(executeCall);
  }
  return executeCall();
}

/**
 * Decodes Google Cloud Pub/Sub base64 payload into emailAddress and historyId
 */
export function decodePubSubNotification(
  base64Payload: string
): PubSubNotification | null {
  if (!base64Payload || typeof base64Payload !== "string") {
    return null;
  }

  try {
    const raw = Buffer.from(base64Payload, "base64").toString("utf-8");
    if (!raw.trim()) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (!parsed.emailAddress || !parsed.historyId) {
      return null;
    }

    return {
      emailAddress: String(parsed.emailAddress),
      historyId: String(parsed.historyId),
    };
  } catch {
    return null;
  }
}

export interface ProcessedPubSubWebhook {
  emailAddress: string;
  historyId: string;
  inngestEvent: {
    name: "app/gmail.history.received";
    data: {
      emailAddress: string;
      historyId: string;
    };
  };
}

export interface PubSubNotificationEnvelope {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

/**
 * Validates and processes a Google Cloud Pub/Sub push notification envelope
 */
export function processGmailPushWebhook(
  envelope: PubSubNotificationEnvelope | unknown
): ProcessedPubSubWebhook | null {
  if (!envelope || typeof envelope !== "object") {
    return null;
  }

  const envObj = envelope as PubSubNotificationEnvelope;
  const messageData = envObj.message?.data;
  if (!messageData || typeof messageData !== "string") {
    return null;
  }

  const decoded = decodePubSubNotification(messageData);
  if (!decoded) {
    return null;
  }

  return {
    emailAddress: decoded.emailAddress,
    historyId: decoded.historyId,
    inngestEvent: {
      name: "app/gmail.history.received",
      data: {
        emailAddress: decoded.emailAddress,
        historyId: decoded.historyId,
      },
    },
  };
}
