import { z } from "zod";

const messageSchema = z.object({
  to: z.email().max(254),
  subject: z.string().trim().min(1).max(160).refine((value) => !/[\r\n]/.test(value)),
  text: z.string().trim().min(1).max(10_000),
});

export type EmailMessage = z.infer<typeof messageSchema>;
export type EmailDeliveryResult = {
  status: "sent" | "not_configured" | "retryable_failure" | "permanent_failure";
  provider: "hostinger_mail" | "none";
};

export interface EmailProvider {
  readonly id: "hostinger_mail";
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}

export class HostingerMailProvider implements EmailProvider {
  readonly id = "hostinger_mail" as const;

  constructor(
    private readonly token: string,
    private readonly mailboxId: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    const parsed = messageSchema.safeParse(message);
    if (!parsed.success) return { status: "permanent_failure", provider: this.id };
    try {
      const response = await this.request(
        `https://api.mail.hostinger.com/api/v1/mailboxes/${this.mailboxId}/send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            to: [parsed.data.to],
            displayName: "SuccessPro",
            subject: parsed.data.subject,
            text: parsed.data.text,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (response.status === 204) return { status: "sent", provider: this.id };
      return {
        status: response.status === 429 || response.status === 502 || response.status >= 500
          ? "retryable_failure"
          : "permanent_failure",
        provider: this.id,
      };
    } catch {
      return { status: "retryable_failure", provider: this.id };
    }
  }
}

export function configuredEmailProvider(
  environment: Record<string, string | undefined> = process.env,
  request: typeof fetch = fetch,
): EmailProvider | null {
  const token = environment.HOSTINGER_MAIL_API_TOKEN?.trim();
  const mailboxId = environment.HOSTINGER_MAILBOX_ID?.trim();
  if (!token || !mailboxId || !/^AC[A-Za-z0-9]+$/.test(mailboxId)) return null;
  return new HostingerMailProvider(token, mailboxId, request);
}

export async function sendTransactionalEmail(
  message: EmailMessage,
  provider: EmailProvider | null = configuredEmailProvider(),
): Promise<EmailDeliveryResult> {
  if (!provider) return { status: "not_configured", provider: "none" };
  return provider.send(message);
}
