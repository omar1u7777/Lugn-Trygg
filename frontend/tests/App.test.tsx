import { render, screen } from "@testing-library/react";
import App from "../src/App"; // Se till att sökvägen stämmer
import React from "react";
import "@testing-library/jest-dom"; // Import this to extend jest matchers

describe("App component", () => {
    it("should render the text 'Registrering'", () => {
        render(<App />);
        const element = screen.getByText(/Registrering/i);
        expect(element).toBeInTheDocument();
    });
});

