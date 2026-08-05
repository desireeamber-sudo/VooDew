import React from "react";
import { Text } from "react-native";
import { render, fireEvent, screen } from "@testing-library/react-native";
import ChecklistRow from "../ChecklistRow";

const baseItem = { id: "1", title: "Pack luggage tags", completed: false };

describe("ChecklistRow", () => {
  test("renders the item title", () => {
    render(<ChecklistRow item={baseItem} onToggle={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByText("Pack luggage tags")).toBeTruthy();
  });

  test("calls onToggle when the checkbox is pressed", () => {
    const onToggle = jest.fn();
    render(<ChecklistRow item={baseItem} onToggle={onToggle} onEdit={jest.fn()} onDelete={jest.fn()} />);
    // The checkbox is the first pressable; find it via its rendered icon's accessibility role isn't
    // set up, so press the title's sibling checkbox by querying the whole row's first Pressable.
    fireEvent.press(screen.UNSAFE_getAllByType(require("react-native").Pressable)[0]);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test("calls onEdit when the title is pressed", () => {
    const onEdit = jest.fn();
    render(<ChecklistRow item={baseItem} onToggle={jest.fn()} onEdit={onEdit} onDelete={jest.fn()} />);
    fireEvent.press(screen.getByText("Pack luggage tags"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  test("calls onDelete when the trash button is pressed", () => {
    const onDelete = jest.fn();
    render(<ChecklistRow item={baseItem} onToggle={jest.fn()} onEdit={jest.fn()} onDelete={onDelete} />);
    const pressables = screen.UNSAFE_getAllByType(require("react-native").Pressable);
    fireEvent.press(pressables[pressables.length - 1]);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test("renders an optional footer node below the title", () => {
    render(
      <ChecklistRow
        item={baseItem}
        onToggle={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        footer={<Text>Reminder set for Today • 9:00 AM</Text>}
      />
    );
    expect(screen.getByText("Reminder set for Today • 9:00 AM")).toBeTruthy();
  });

  test("does not render a footer wrapper when no footer is provided", () => {
    render(<ChecklistRow item={baseItem} onToggle={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.queryByText(/Reminder/)).toBeNull();
  });
});
