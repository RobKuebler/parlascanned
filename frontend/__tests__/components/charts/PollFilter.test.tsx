import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PollFilter } from "@/components/charts/PollFilter";
import { Poll } from "@/lib/data";

const POLLS: Poll[] = [
  { poll_id: 100, topic: "Mindestlohn erhöhen" },
  { poll_id: 101, topic: "Klimaschutzgesetz" },
  { poll_id: 102, topic: "Bundeswehr Sondervermögen" },
  { poll_id: 103, topic: "Cannabis-Legalisierung" },
];

describe("PollFilter", () => {
  describe("dropdown filtering", () => {
    it("shows no dropdown when input is empty and unfocused", () => {
      render(
        <PollFilter polls={POLLS} selectedIds={[]} onChange={jest.fn()} />,
      );
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("shows dropdown with all polls when input is focused", async () => {
      render(
        <PollFilter polls={POLLS} selectedIds={[]} onChange={jest.fn()} />,
      );
      await userEvent.click(
        screen.getByPlaceholderText("Abstimmungen suchen…"),
      );
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(screen.getAllByRole("option")).toHaveLength(4);
    });

    it("filters polls by topic when typing", async () => {
      render(
        <PollFilter polls={POLLS} selectedIds={[]} onChange={jest.fn()} />,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Abstimmungen suchen…"),
        "klima",
      );
      expect(screen.getAllByRole("option")).toHaveLength(1);
      expect(
        screen.getByRole("option", { name: /Klimaschutzgesetz/ }),
      ).toBeInTheDocument();
    });

    it("hides already-selected polls from dropdown", async () => {
      render(
        <PollFilter polls={POLLS} selectedIds={[101]} onChange={jest.fn()} />,
      );
      await userEvent.click(
        screen.getByPlaceholderText("Abstimmungen suchen…"),
      );
      const options = screen.getAllByRole("option");
      const optionTexts = options.map((o) => o.textContent);
      expect(optionTexts.join()).not.toContain("Klimaschutzgesetz");
    });

    it('shows "Keine Ergebnisse" when no polls match', async () => {
      render(
        <PollFilter polls={POLLS} selectedIds={[]} onChange={jest.fn()} />,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Abstimmungen suchen…"),
        "zzzzz",
      );
      expect(screen.getByText("Keine Ergebnisse")).toBeInTheDocument();
    });
  });

  describe("selection", () => {
    it("calls onChange with new id when a poll is clicked", async () => {
      const onChange = jest.fn();
      render(<PollFilter polls={POLLS} selectedIds={[]} onChange={onChange} />);
      await userEvent.type(
        screen.getByPlaceholderText("Abstimmungen suchen…"),
        "Mindest",
      );
      await userEvent.click(
        screen.getByRole("option", { name: /Mindestlohn/ }),
      );
      expect(onChange).toHaveBeenCalledWith([100]);
    });

    it("appends to existing selection", async () => {
      const onChange = jest.fn();
      render(
        <PollFilter polls={POLLS} selectedIds={[100]} onChange={onChange} />,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Abstimmungen suchen…"),
        "Cannabis",
      );
      await userEvent.click(screen.getByRole("option", { name: /Cannabis/ }));
      expect(onChange).toHaveBeenCalledWith([100, 103]);
    });
  });

  describe("chips", () => {
    it("renders a chip for each selected poll", () => {
      render(
        <PollFilter
          polls={POLLS}
          selectedIds={[100, 101]}
          onChange={jest.fn()}
        />,
      );
      expect(screen.getByText(/Mindestlohn/)).toBeInTheDocument();
      expect(screen.getByText(/Klimaschutzgesetz/)).toBeInTheDocument();
    });

    it("removes poll from selection when chip × is clicked", async () => {
      const onChange = jest.fn();
      render(
        <PollFilter
          polls={POLLS}
          selectedIds={[100, 101]}
          onChange={onChange}
        />,
      );
      // Find the remove button for Mindestlohn chip
      const removeButtons = screen.getAllByRole("button", {
        name: /Entferne/,
      });
      await userEvent.click(removeButtons[0]);
      expect(onChange).toHaveBeenCalledWith([101]);
    });
  });

  describe("dropdown close behavior", () => {
    it("closes dropdown when Escape is pressed", async () => {
      render(
        <PollFilter polls={POLLS} selectedIds={[]} onChange={jest.fn()} />,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Abstimmungen suchen…"),
        "klima",
      );
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("closes dropdown when clicking outside", async () => {
      render(
        <div>
          <PollFilter polls={POLLS} selectedIds={[]} onChange={jest.fn()} />
          <div data-testid="outside">outside</div>
        </div>,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Abstimmungen suchen…"),
        "klima",
      );
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      await userEvent.click(screen.getByTestId("outside"));
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  describe("quick-filter chips", () => {
    it("renders divergent chip when divergentPollIds is provided", () => {
      render(
        <PollFilter
          polls={POLLS}
          selectedIds={[]}
          onChange={jest.fn()}
          divergentPollIds={[100, 101]}
        />,
      );
      expect(screen.getByText("Unterschiedlich")).toBeInTheDocument();
    });

    it("calls onChange with divergent poll ids when chip is clicked", async () => {
      const onChange = jest.fn();
      render(
        <PollFilter
          polls={POLLS}
          selectedIds={[]}
          onChange={onChange}
          divergentPollIds={[100, 101]}
        />,
      );
      await userEvent.click(screen.getByText("Unterschiedlich"));
      expect(onChange).toHaveBeenCalledWith([100, 101]);
    });
  });
});
