import React from "react";
import type { Tool, Color, Width } from "./types/whiteboard";
import { FaPen, FaEraser } from "react-icons/fa";
import { IconButton } from "../../components/IconButton";

interface ToolbarProps {
  tool: Tool;
  color: Color;
  width: Width;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: Color) => void;
  onWidthChange: (width: Width) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  color,
  width,
  onToolChange,
  onColorChange,
  onWidthChange,
}) => {
  const colors = ["#000000", "#FF0000", "#0000FF"];
  const widths = [2, 4, 8, 12, 16];

  return (
    <div
      className="flex flex-row items-center justify-center gap-0 bg-gray-50 w-full overflow-hidden shadow-lg px-6 py-3"
      style={{ minWidth: "340px" }}
    >
      <div className="flex flex-col items-center px-2">
        <div className="flex gap-2 bg-white rounded-xl p-2 shadow-sm border border-gray-200">
          <IconButton
            onClick={() => onToolChange("pen")}
            className={`w-10 h-10 flex items-center justify-center transition-all duration-100 ${
              tool === "pen"
                ? "bg-blue-500 text-white ring-2 ring-blue-400 scale-110"
                : "bg-white text-gray-600 hover:bg-blue-100"
            }`}
          >
            <FaPen className="w-5 h-5" title="ペン" />
          </IconButton>
          <IconButton
            onClick={() => onToolChange("eraser")}
            className={`w-10 h-10 flex items-center justify-center transition-all duration-100 ${
              tool === "eraser"
                ? "bg-blue-500 text-white ring-2 ring-blue-400 scale-110"
                : "bg-white text-gray-600 hover:bg-blue-100"
            }`}
          >
            <FaEraser className="w-5 h-5" title="消しゴム" />
          </IconButton>
        </div>
      </div>

      {/* Divider */}
      <div className="h-12 w-px bg-gray-300 mx-4" />

      {/* Colors Section (丸ボタンのみ) */}
      <div className="flex flex-col items-center px-2">
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl p-2 shadow-sm border border-gray-200">
          {/* 固定色 */}
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              className={`w-10 h-10 rounded-full border-4 transition-all duration-100 ${
                color === c
                  ? "border-blue-500 shadow-lg scale-110"
                  : "border-gray-300 hover:border-blue-300"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="h-12 w-px bg-gray-300 mx-4" />

      {/* Width Section (丸のみ) */}
      <div className="flex flex-col items-center px-2">
        <div className="flex gap-2 bg-white rounded-xl p-2 shadow-sm border border-gray-200">
          {widths.map((w) => (
            <IconButton
              key={w}
              onClick={() => onWidthChange(w)}
              className={`w-10 h-10 flex items-center justify-center transition-all duration-100 ${
                width === w
                  ? "bg-blue-500 text-white ring-2 ring-blue-400 scale-110"
                  : "bg-white text-gray-600 hover:bg-blue-100"
              }`}
            >
              <div
                className="rounded-full bg-current"
                style={{
                  width: `${Math.max(6, w + 2)}px`,
                  height: `${Math.max(6, w + 2)}px`,
                }}
                title={`${w}px`}
              />
            </IconButton>
          ))}
        </div>
      </div>
    </div>
  );
};

Toolbar.displayName = "Toolbar";
