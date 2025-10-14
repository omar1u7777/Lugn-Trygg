import { describe, it, expect } from "@jest/globals";
import { extractDisplayName, testNameExtraction } from "../nameUtils";

describe("AI Name Extraction", () => {
  it("should extract and format names correctly", () => {
    expect(extractDisplayName("marah.ghaleb.12@gmail.com")).toBe("Marah Ghaleb");
    expect(extractDisplayName("john.doe@gmail.com")).toBe("John Doe");
    expect(extractDisplayName("mary.jane.smith@outlook.com")).toBe("Mary Jane");
    expect(extractDisplayName("user123@gmail.com")).toBe("User");
    expect(extractDisplayName("test_user@domain.com")).toBe("Test User");
    expect(extractDisplayName("simple@gmail.com")).toBe("Simple");
    expect(extractDisplayName("")).toBe("Användare");
    expect(extractDisplayName("no-at-symbol")).toBe("Noatsymbol");
  });

  it("should handle edge cases", () => {
    expect(extractDisplayName("a.b.c.d@gmail.com")).toBe("A B"); // Only first 2 parts
    expect(extractDisplayName("single@gmail.com")).toBe("Single");
    expect(extractDisplayName("with_underscore@gmail.com")).toBe("With Underscore");
    expect(extractDisplayName("numbers123@gmail.com")).toBe("Numbers");
  });

  it("should provide test examples", () => {
    const examples = testNameExtraction();
    expect(examples).toHaveLength(6);
    const firstExample = examples[0];
    expect(firstExample?.email).toBe("marah.ghaleb.12@gmail.com");
    expect(firstExample?.extracted).toBe("Marah Ghaleb");
  });
});