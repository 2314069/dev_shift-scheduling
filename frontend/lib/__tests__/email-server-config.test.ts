import { describe, expect, it } from "vitest";
import { buildEmailServerConfig } from "@/lib/email-server-config";

describe("buildEmailServerConfig", () => {
  it("uses local Mailpit defaults without SMTP auth", () => {
    expect(buildEmailServerConfig({})).toEqual({
      host: "localhost",
      port: 1025,
      secure: false,
    });
  });

  it("enables implicit TLS by default for port 465", () => {
    expect(
      buildEmailServerConfig({
        EMAIL_SERVER_HOST: "smtp.resend.com",
        EMAIL_SERVER_PORT: "465",
        EMAIL_SERVER_USER: "resend",
        EMAIL_SERVER_PASSWORD: "re_test",
      }),
    ).toEqual({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: {
        user: "resend",
        pass: "re_test",
      },
    });
  });

  it("allows STARTTLS style ports to be configured explicitly", () => {
    expect(
      buildEmailServerConfig({
        EMAIL_SERVER_HOST: "smtp.resend.com",
        EMAIL_SERVER_PORT: "587",
        EMAIL_SERVER_SECURE: "false",
        EMAIL_SERVER_USER: "resend",
        EMAIL_SERVER_PASSWORD: "re_test",
      }),
    ).toMatchObject({
      host: "smtp.resend.com",
      port: 587,
      secure: false,
    });
  });

  it("does not send partial SMTP credentials", () => {
    expect(
      buildEmailServerConfig({
        EMAIL_SERVER_USER: "resend",
      }),
    ).not.toHaveProperty("auth");
  });
});
