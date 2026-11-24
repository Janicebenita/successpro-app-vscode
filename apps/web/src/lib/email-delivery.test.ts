import { describe, expect, it, vi } from "vitest";
import { configuredEmailProvider, HostingerMailProvider, sendTransactionalEmail } from "./email-delivery";

const message = { to: "member@example.com", subject: "Support request received", text: "We received your request." };

describe("transactional email delivery", () => {
  it("does not send without a mailbox-scoped credential", async () => {
    const request = vi.fn<typeof fetch>();
    const provider = configuredEmailProvider({}, request);
    expect(provider).toBeNull();
    expect(await sendTransactionalEmail(message, provider)).toEqual({ status: "not_configured", provider: "none" });
    expect(request).not.toHaveBeenCalled();
  });

  it("uses only the fixed Hostinger endpoint and a single addressed recipient", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const provider = configuredEmailProvider({ HOSTINGER_MAIL_API_TOKEN: "mail-secret", HOSTINGER_MAILBOX_ID: "AC12345" }, request);
    expect(await sendTransactionalEmail(message, provider)).toEqual({ status: "sent", provider: "hostinger_mail" });
    expect(request).toHaveBeenCalledOnce();
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("https://api.mail.hostinger.com/api/v1/mailboxes/AC12345/send");
    expect(init?.method).toBe("POST");
    expect(init?.cache).toBe("no-store");
    expect(JSON.parse(String(init?.body))).toEqual({ to: [message.to], displayName: "SuccessPro", subject: message.subject, text: message.text });
  });

  it("rejects malformed addresses and header injection before network use", async () => {
    const request = vi.fn<typeof fetch>();
    const provider = new HostingerMailProvider("mail-secret", "AC12345", request);
    expect(await provider.send({ ...message, to: "not-an-address" })).toMatchObject({ status: "permanent_failure" });
    expect(await provider.send({ ...message, subject: "Receipt\nBcc: attacker@example.com" })).toMatchObject({ status: "permanent_failure" });
    expect(request).not.toHaveBeenCalled();
  });

  it("classifies service outages as retryable without exposing credentials", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 502 }));
    const provider = new HostingerMailProvider("mail-secret", "AC12345", request);
    expect(await provider.send(message)).toEqual({ status: "retryable_failure", provider: "hostinger_mail" });
    request.mockRejectedValueOnce(new Error("network failed with mail-secret"));
    expect(await provider.send(message)).toEqual({ status: "retryable_failure", provider: "hostinger_mail" });
  });

  it("does not accept a malformed mailbox ID from configuration", () => {
    expect(configuredEmailProvider({ HOSTINGER_MAIL_API_TOKEN: "x", HOSTINGER_MAILBOX_ID: "../other" })).toBeNull();
  });
});
