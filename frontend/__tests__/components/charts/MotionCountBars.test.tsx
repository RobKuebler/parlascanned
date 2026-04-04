import React from "react";
import { render, screen } from "@testing-library/react";
import { MotionCountBars } from "@/components/charts/MotionCountBars";

const items = [
  { party: "AfD", count: 847 },
  { party: "SPD", count: 531 },
];

it("renders all party names", () => {
  render(<MotionCountBars items={items} label="Test" sublabel="sub" />);
  expect(screen.getByText("AfD")).toBeInTheDocument();
  expect(screen.getByText("SPD")).toBeInTheDocument();
});

it("renders label and sublabel", () => {
  render(<MotionCountBars items={items} label="Anzahl" sublabel="Gesamt" />);
  expect(screen.getByText("Anzahl")).toBeInTheDocument();
  expect(screen.getByText("Gesamt")).toBeInTheDocument();
});

it("renders count formatted with German locale", () => {
  render(
    <MotionCountBars
      items={[{ party: "AfD", count: 1234 }]}
      label="X"
      sublabel="Y"
    />,
  );
  // German locale formats 1234 as "1.234"
  expect(screen.getByText("1.234")).toBeInTheDocument();
});

it("renders empty items without crashing", () => {
  render(<MotionCountBars items={[]} label="X" sublabel="Y" />);
  expect(screen.getByText("X")).toBeInTheDocument();
});
