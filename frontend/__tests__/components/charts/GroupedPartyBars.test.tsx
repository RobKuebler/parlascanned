import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  GroupedPartyBars,
  type GroupedBarSection,
} from "@/components/charts/GroupedPartyBars";

const sections: GroupedBarSection[] = [
  { label: "Rubrik A", partyValues: { SPD: 80, CDU: 60 } },
  { label: "Rubrik B", partyValues: { SPD: 40, CDU: 70 } },
  { label: "Gesamt", partyValues: { SPD: 120, CDU: 130 }, variant: "total" },
];
const parties = ["SPD", "CDU"];

describe("GroupedPartyBars — rubrik-first (default)", () => {
  it("renders section headers", () => {
    render(<GroupedPartyBars sections={sections} parties={parties} />);
    expect(screen.getByText("Rubrik A")).toBeInTheDocument();
    expect(screen.getByText("Rubrik B")).toBeInTheDocument();
  });

  it("renders party labels as bars", () => {
    render(<GroupedPartyBars sections={sections} parties={parties} />);
    // SPD appears once per section (including total) = 3 times
    expect(screen.getAllByText("SPD")).toHaveLength(3);
  });
});

describe("GroupedPartyBars — toggle UI", () => {
  it("does not render toggle when allowGroupToggle is false", () => {
    render(<GroupedPartyBars sections={sections} parties={parties} />);
    expect(screen.queryByText("Partei")).toBeNull();
  });

  it("renders toggle when allowGroupToggle is true", () => {
    render(
      <GroupedPartyBars
        sections={sections}
        parties={parties}
        // @ts-expect-error allowGroupToggle not yet implemented — TDD
        allowGroupToggle
      />,
    );
    expect(screen.getByText("Rubrik")).toBeInTheDocument();
    expect(screen.getByText("Partei")).toBeInTheDocument();
  });
});

describe("GroupedPartyBars — partei-first view", () => {
  function renderToggled() {
    render(
      <GroupedPartyBars
        sections={sections}
        parties={parties}
        // @ts-expect-error allowGroupToggle not yet implemented — TDD
        allowGroupToggle
      />,
    );
    fireEvent.click(screen.getByText("Partei"));
  }

  it("renders party names as section headers after toggle", () => {
    renderToggled();
    expect(screen.getAllByText("SPD").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("CDU").length).toBeGreaterThanOrEqual(1);
  });

  it("renders rubrik labels as bars after toggle", () => {
    renderToggled();
    expect(screen.getByText("Rubrik A")).toBeInTheDocument();
    expect(screen.getByText("Rubrik B")).toBeInTheDocument();
  });

  it("excludes total sections from partei-first view", () => {
    renderToggled();
    expect(screen.queryByText("Gesamt")).toBeNull();
  });

  it("switching back to Rubrik restores original view", () => {
    renderToggled();
    fireEvent.click(screen.getByText("Rubrik"));
    expect(screen.getByText("Gesamt")).toBeInTheDocument();
  });
});
