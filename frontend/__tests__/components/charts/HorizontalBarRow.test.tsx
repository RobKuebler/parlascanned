import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HorizontalBarRow } from "@/components/charts/HorizontalBarRow";

const base = {
  label: "SPD",
  labelWidth: 80,
  value: 50,
  max: 100,
  color: "#E3000F",
  displayValue: "50K",
};

it("renders label", () => {
  render(<HorizontalBarRow {...base} />);
  expect(screen.getByText("SPD")).toBeInTheDocument();
});

it("renders displayValue", () => {
  render(<HorizontalBarRow {...base} />);
  expect(screen.getByText("50K")).toBeInTheDocument();
});

it("renders rank when provided", () => {
  render(<HorizontalBarRow {...base} rank={3} />);
  expect(screen.getByText("3")).toBeInTheDocument();
});

it("does not render rank element when rank is undefined", () => {
  render(<HorizontalBarRow {...base} />);
  // rank column is absent - only label, track, value divs present at top level
  expect(screen.queryByText(/^\d+$/)).toBeNull();
});

it("bar fill width is proportional to value/max", () => {
  const { container } = render(
    <HorizontalBarRow {...base} value={25} max={100} />,
  );
  const fill = container.querySelector(
    "[data-testid='bar-fill']",
  ) as HTMLElement;
  expect(fill.style.width).toBe("25%");
});

it("bar fill width is 0% when value is 0", () => {
  const { container } = render(
    <HorizontalBarRow {...base} value={0} max={100} />,
  );
  const fill = container.querySelector(
    "[data-testid='bar-fill']",
  ) as HTMLElement;
  expect(fill.style.width).toBe("0%");
});

it("bar fill width is 100% when value equals max", () => {
  const { container } = render(
    <HorizontalBarRow {...base} value={100} max={100} />,
  );
  const fill = container.querySelector(
    "[data-testid='bar-fill']",
  ) as HTMLElement;
  expect(fill.style.width).toBe("100%");
});

it("does not crash when max is 0", () => {
  render(<HorizontalBarRow {...base} value={0} max={0} />);
  expect(screen.getByText("SPD")).toBeInTheDocument();
});

// ── Tooltip tests ──────────────────────────────────────────────────────────────

describe("label tooltip", () => {
  // Helper: make the label span appear truncated by mocking scrollWidth > offsetWidth
  function mockTruncated(container: HTMLElement) {
    const label = container.querySelector(
      "[data-testid='bar-label']",
    ) as HTMLElement;
    Object.defineProperty(label, "scrollWidth", {
      get() {
        return 200;
      },
      configurable: true,
    });
    Object.defineProperty(label, "offsetWidth", {
      get() {
        return 80;
      },
      configurable: true,
    });
  }

  // Helper: make the label span appear NOT truncated
  function mockNotTruncated(container: HTMLElement) {
    const label = container.querySelector(
      "[data-testid='bar-label']",
    ) as HTMLElement;
    Object.defineProperty(label, "scrollWidth", {
      get() {
        return 80;
      },
      configurable: true,
    });
    Object.defineProperty(label, "offsetWidth", {
      get() {
        return 80;
      },
      configurable: true,
    });
  }

  it("does not show tooltip on hover when label is not truncated", () => {
    const { container } = render(<HorizontalBarRow {...base} />);
    mockNotTruncated(container);
    const label = container.querySelector(
      "[data-testid='bar-label']",
    ) as HTMLElement;
    fireEvent.mouseEnter(label);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows tooltip on mouse enter when label is truncated", () => {
    const { container } = render(
      <HorizontalBarRow {...base} label="Very long label text" />,
    );
    mockTruncated(container);
    const label = container.querySelector(
      "[data-testid='bar-label']",
    ) as HTMLElement;
    act(() => {
      fireEvent(window, new Event("resize"));
    });
    fireEvent.mouseEnter(label);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Very long label text",
    );
  });

  it("hides tooltip on mouse leave", () => {
    const { container } = render(
      <HorizontalBarRow {...base} label="Very long label text" />,
    );
    mockTruncated(container);
    const label = container.querySelector(
      "[data-testid='bar-label']",
    ) as HTMLElement;
    act(() => {
      fireEvent(window, new Event("resize"));
    });
    fireEvent.mouseEnter(label);
    fireEvent.mouseLeave(label);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows tooltip on click when label is truncated (mobile)", () => {
    const { container } = render(
      <HorizontalBarRow {...base} label="Very long label text" />,
    );
    mockTruncated(container);
    const label = container.querySelector(
      "[data-testid='bar-label']",
    ) as HTMLElement;
    act(() => {
      fireEvent(window, new Event("resize"));
    });
    fireEvent.click(label);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("does not show tooltip on click when label is not truncated", () => {
    const { container } = render(<HorizontalBarRow {...base} />);
    mockNotTruncated(container);
    const label = container.querySelector(
      "[data-testid='bar-label']",
    ) as HTMLElement;
    act(() => {
      fireEvent(window, new Event("resize"));
    });
    fireEvent.click(label);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
