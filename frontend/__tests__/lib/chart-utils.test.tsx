import React from "react";
import { render } from "@testing-library/react";

// D3 is ESM-only and not transformed by Jest, so we mock it.
jest.mock("d3", () => ({}));

import { ChartTooltip, TOOLTIP_DX, TOOLTIP_DY } from "@/lib/chart-utils";

describe("tooltip constants", () => {
  it("TOOLTIP_DX is a positive number", () => {
    expect(TOOLTIP_DX).toBeGreaterThan(0);
  });

  it("TOOLTIP_DY is a negative number (above cursor)", () => {
    expect(TOOLTIP_DY).toBeLessThan(0);
  });
});

describe("ChartTooltip", () => {
  it("renders a hidden div with ref", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ChartTooltip tooltipRef={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current!.style.opacity).toBe("0");
    expect(ref.current!.style.position).toBe("absolute");
  });

  it("applies custom maxWidth when provided", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ChartTooltip tooltipRef={ref} maxWidth={300} />);
    expect(ref.current!.style.maxWidth).toBe("300px");
  });

  it("defaults to zIndex 10", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ChartTooltip tooltipRef={ref} />);
    expect(ref.current!.style.zIndex).toBe("10");
  });

  it("accepts custom zIndex", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ChartTooltip tooltipRef={ref} zIndex={50} />);
    expect(ref.current!.style.zIndex).toBe("50");
  });

  it("uses nowrap when maxWidth is not set", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ChartTooltip tooltipRef={ref} />);
    expect(ref.current!.style.whiteSpace).toBe("nowrap");
  });
});
