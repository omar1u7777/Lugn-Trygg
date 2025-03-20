import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "../src/App"; // Din huvudkomponent
import TestProviders from "../src/utils/TestProviders"; // Testproviders för att ge rätt kontext
import * as api from "../src/api/api"; // API-funktioner för mockning
import React from "react";

describe("🔍 Autentiseringsflöden", () => {
  
  // Test för att kontrollera att länkarna renderas
  it("✅ Renderar navigering och länkar", async () => {
    render(<App />, { wrapper: TestProviders });

    const loginLinks = await screen.findAllByText(/logga in/i);
    expect(loginLinks.length).toBeGreaterThan(0);

    expect(await screen.findByText(/registrera/i)).toBeInTheDocument();
  });

  // Test för registrering
  it("✅ Registrering fungerar", async () => {
    vi.spyOn(api, "registerUser").mockResolvedValueOnce({
      message: "Registrering lyckades!",
    });

    render(<App />, { wrapper: TestProviders });

    fireEvent.change(await screen.findByLabelText(/📩 E-post:/i), {
      target: { value: "newuser@example.com" },
    });
    fireEvent.change(await screen.findByLabelText(/🔑 Lösenord:/i), {
      target: { value: "Test123!" },
    });

    const confirmPasswordInput = screen.getByLabelText(/bekräfta lösenord/i);
    fireEvent.change(confirmPasswordInput, { target: { value: "Test123!" } });

    fireEvent.click(screen.getByRole("button", { name: /skapa konto/i }));

    await waitFor(() =>
      expect(screen.getByText(/registrering lyckades/i)).toBeInTheDocument()
    );
  });

  // Test för inloggning och navigation till dashboard
  it("✅ Inloggning fungerar och navigerar till dashboard", async () => {
    vi.spyOn(api, "loginUser").mockResolvedValueOnce({
      access_token: "mocked_token",
      user: { email: "test@example.com", user_id: "123" },
    });

    render(<App />, { wrapper: TestProviders });

    fireEvent.change(await screen.findByLabelText(/📩 E-post:/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(await screen.findByLabelText(/🔑 Lösenord:/i), {
      target: { value: "Test123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /logga in/i }));

    await waitFor(() => {
      expect(screen.getByText(/dashboard|välkommen|hem/i)).toBeInTheDocument();
    });
  });

  // Test för utloggning
  it("✅ Utloggning fungerar", async () => {
    render(<App />, { wrapper: TestProviders });

    // Förutsätt att användaren är inloggad
    fireEvent.click(screen.getByRole("button", { name: /logga ut/i }));

    await waitFor(() => {
      expect(screen.getByText(/logga in/i)).toBeInTheDocument();
    });
  });

  // Test för felmeddelande vid misslyckad registrering
  it("✅ Visar felmeddelande vid misslyckad registrering", async () => {
    vi.spyOn(api, "registerUser").mockRejectedValueOnce({
      response: { data: { error: "E-postadressen är redan registrerad." } },
    });

    render(<App />, { wrapper: TestProviders });

    fireEvent.change(await screen.findByLabelText(/📩 E-post:/i), {
      target: { value: "used@example.com" },
    });
    fireEvent.change(await screen.findByLabelText(/🔑 Lösenord:/i), {
      target: { value: "Test123!" },
    });

    const confirmPasswordInput = screen.getByLabelText(/bekräfta lösenord/i);
    fireEvent.change(confirmPasswordInput, { target: { value: "Test123!" } });

    fireEvent.click(screen.getByRole("button", { name: /skapa konto/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/e-postadressen är redan registrerad/i)
      ).toBeInTheDocument()
    );
  });
});
