import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardHome } from "@/components/dashboard/dashboard-home";

describe("DashboardHome", () => {
  it("renders mission list and proof-of-delivery form baseline", () => {
    render(<DashboardHome />);

    expect(screen.getByRole("heading", { name: "Field Missions" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Proof of Delivery" })).toBeTruthy();

    expect(screen.getByText("M-1001")).toBeTruthy();
    expect(screen.getByLabelText("Recipient name")).toBeTruthy();
    expect(screen.getByLabelText("Delivery note")).toBeTruthy();
  });
});
