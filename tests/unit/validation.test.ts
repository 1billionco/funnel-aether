import { describe, expect, it } from "vitest";

import { signUpSchema } from "@/lib/validation/auth";
import {
  brandQuestionnaireSchema,
  createOrgSchema,
  listField,
  questionnaireFromForm,
} from "@/lib/validation/org";

describe("org validation", () => {
  it("requires a market", () => {
    expect(createOrgSchema.safeParse({ name: "Acme" }).success).toBe(false);
    expect(createOrgSchema.safeParse({ name: "Acme", market: "NG" }).success).toBe(true);
    expect(createOrgSchema.safeParse({ name: "Acme", market: "US" }).success).toBe(false);
  });

  it("splits list fields on commas and newlines, de-duplicated", () => {
    expect(listField().parse("cheap, cheap,\n guaranteed ,")).toEqual(["cheap", "guaranteed"]);
    expect(listField().parse(undefined)).toEqual([]);
  });

  it("normalises website and WhatsApp number", () => {
    const fd = new FormData();
    fd.set("offer", "Phones and home appliances");
    fd.set("audience", "Families in Lagos");
    fd.set("websiteUrl", "chinedu.ng");
    fd.set("whatsappNumber", "+234 803 000 0000");
    fd.set("tone.formal_casual", "80");
    const parsed = brandQuestionnaireSchema.parse(questionnaireFromForm(fd));
    expect(parsed.websiteUrl).toBe("https://chinedu.ng");
    expect(parsed.whatsappNumber).toBe("+2348030000000");
    expect(parsed.tone).toEqual({
      formal_casual: 80,
      playful_serious: 50,
      concise_detailed: 50,
      bold_reassuring: 50,
    });
  });

  it("rejects an implausible phone number", () => {
    const fd = new FormData();
    fd.set("offer", "abc");
    fd.set("audience", "abc");
    fd.set("whatsappNumber", "12");
    expect(brandQuestionnaireSchema.safeParse(questionnaireFromForm(fd)).success).toBe(false);
  });
});

describe("auth validation", () => {
  it("normalises email and invite code", () => {
    const r = signUpSchema.parse({
      email: " Sarah@Hartley.co.uk ",
      inviteCode: "beta-123",
      password: "",
    });
    expect(r.email).toBe("sarah@hartley.co.uk");
    expect(r.inviteCode).toBe("BETA-123");
    expect(r.password).toBeUndefined();
  });
});
