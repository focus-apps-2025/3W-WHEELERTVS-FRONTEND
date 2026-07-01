import React from "react";
import { Palette } from "lucide-react";

interface TeamColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
}

const teamColors = [
  { name: "Blue", value: "blue" },
  { name: "Green", value: "green" },
  { name: "Purple", value: "purple" },
  { name: "Red", value: "red" },
  { name: "Orange", value: "orange" },
  { name: "Teal", value: "teal" },
];

export default function TeamColorPicker({
  selectedColor,
  onColorChange,
}: TeamColorPickerProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary-700 mb-1">
        Team Color
      </label>
      <div className="grid grid-cols-6 gap-2">
        {teamColors.map(({ name, value }) => (
          <label
            key={value}
            className={`relative flex items-center justify-center p-2 rounded-lg cursor-pointer border-2 transition-all ${
              selectedColor === value
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="color"
              value={value}
              checked={selectedColor === value}
              onChange={(e) => onColorChange(e.target.value)}
              className="sr-only"
            />
            <Palette className={`w-5 h-5 text-${value}-500`} />
            <span className="sr-only">{name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
