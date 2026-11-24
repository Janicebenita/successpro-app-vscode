import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Terms from "./terms/page";
import DataPolicy from "./data-policy/page";
import PrivacyPolicy from "./privacy-policy/page";
import CookiePolicy from "./cookie-policy/page";
import CancellationPolicy from "./cancellation-policy/page";
import RefundPolicy from "./refund-policy/page";
import DeliveryPolicy from "./delivery-policy/page";
import Contact from "./contact/page";

const pages = [Terms, DataPolicy, PrivacyPolicy, CookiePolicy, CancellationPolicy, RefundPolicy, DeliveryPolicy, Contact];

describe("public legal pages", () => {
  it.each(pages)("renders a current, navigable policy", (Page) => {
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain("Effective date: 1 October 2026");
    expect(html).toContain("support@successpro.xfactor.ltd");
    expect(html).toContain('aria-label="Related policies"');
    expect(html).toContain('href="/refund-policy"');
  });

  it("sets Chennai courts only where mandatory consumer forums remain available", () => {
    const html = renderToStaticMarkup(<Terms />);
    expect(html).toContain("courts with appropriate subject-matter jurisdiction in Chennai");
    expect(html).toContain("This clause does not prevent either party from seeking relief before a consumer commission");
    expect(html).toContain("Their names, logos, and trademarks belong to their respective owners");
  });

  it("discloses AI data sharing and keeps optional tracking separate", () => {
    const html = renderToStaticMarkup(<DataPolicy />);
    expect(html).toContain("external model provider");
    expect(html).toContain("own retention or service-improvement practices");
    expect(html).toContain("optional analytics or advertising tracking each have their own controls");
  });

  it("does not describe paid digital services as unconditionally non-refundable", () => {
    const html = renderToStaticMarkup(<RefundPolicy />);
    expect(html).toContain("Nothing in this policy limits a statutory refund");
    expect(html).toContain("defective, misdescribed, or not delivered as agreed");
  });
});
