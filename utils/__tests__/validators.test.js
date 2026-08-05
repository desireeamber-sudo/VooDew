import { isRequired, isValidAmount, isValidUrl, isValidEmail, validateFields } from "../validators";

describe("isRequired (used for required trip fields like title/date)", () => {
  test("rejects empty, whitespace-only, null, and undefined", () => {
    expect(isRequired("")).toBe(false);
    expect(isRequired("   ")).toBe(false);
    expect(isRequired(null)).toBe(false);
    expect(isRequired(undefined)).toBe(false);
  });

  test("accepts a non-empty string", () => {
    expect(isRequired("Karaoke Night")).toBe(true);
  });
});

describe("isValidAmount (used for expense amount)", () => {
  test("accepts a positive number, as a string or a number", () => {
    expect(isValidAmount("120")).toBe(true);
    expect(isValidAmount(120)).toBe(true);
  });

  test("rejects zero", () => {
    expect(isValidAmount("0")).toBe(false);
  });

  test("rejects negative amounts", () => {
    expect(isValidAmount("-20")).toBe(false);
  });

  test("rejects non-numeric or empty input", () => {
    expect(isValidAmount("abc")).toBe(false);
    expect(isValidAmount("")).toBe(false);
  });
});

describe("isValidUrl (used for reservation links)", () => {
  test("accepts http and https URLs", () => {
    expect(isValidUrl("https://example.com/ticket")).toBe(true);
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  test("rejects a plain non-URL string", () => {
    expect(isValidUrl("not a url")).toBe(false);
  });

  test("rejects a non-http(s) scheme", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
  });

  test("rejects an empty value", () => {
    expect(isValidUrl("")).toBe(false);
  });
});

describe("isValidEmail (optional field on travelers)", () => {
  test("treats an empty value as valid, since email is optional", () => {
    expect(isValidEmail("")).toBe(true);
  });

  test("accepts a well-formed email address", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
  });

  test("rejects a malformed email address", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
  });
});

describe("validateFields", () => {
  test("collects an error for each failing rule and omits passing ones", () => {
    const errors = validateFields(
      { title: "", amount: "50" },
      {
        title: { check: isRequired, message: "Title is required." },
        amount: { check: isValidAmount, message: "Enter a valid amount." }
      }
    );
    expect(errors).toEqual({ title: "Title is required." });
  });

  test("returns an empty object when every rule passes", () => {
    const errors = validateFields(
      { title: "Trip", amount: "50" },
      {
        title: { check: isRequired, message: "Title is required." },
        amount: { check: isValidAmount, message: "Enter a valid amount." }
      }
    );
    expect(errors).toEqual({});
  });
});
