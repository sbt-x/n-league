import React from "react";
import { Toolbar } from "./Toolbar.tsx";
import { Canvas } from "./Canvas.tsx";
import { useTool } from "./hooks/useTool.ts";

export type WhiteboardProps = {
  showToolbar?: boolean;
};

export const Whiteboard: React.FC<WhiteboardProps> = ({
  showToolbar = false,
}) => {
  const { tool, setTool, color, setColor, width, setWidth } = useTool();

  return (
    <div className="flex flex-col w-full h-full bg-gray-50">
      {/* ツールバー */}
      {showToolbar && (
        <div className="w-full flex items-center py-2 bg-gray-100 border-b border-gray-300">
          <Toolbar
            tool={tool}
            color={color}
            width={width}
            onToolChange={setTool}
            onColorChange={setColor}
            onWidthChange={setWidth}
          />
        </div>
      )}
      {/* Canvas領域 */}
      <div className="flex-1 w-full h-full">
        <Canvas tool={tool} color={color} width={width} />
      </div>
    </div>
  );
};
