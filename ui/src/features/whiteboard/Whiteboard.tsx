import React, { useImperativeHandle, forwardRef } from "react";
import { Toolbar } from "./Toolbar.tsx";
import { Canvas } from "./Canvas.tsx";
import { useTool } from "./hooks/useTool.ts";

export type WhiteboardProps = {
  showToolbar?: boolean;
  disabled?: boolean;
};

export type WhiteboardHandle = {
  clear: () => void;
};

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(
  ({ showToolbar = false, disabled = false }, ref) => {
    const { tool, setTool, color, setColor, width, setWidth } = useTool();
    const canvasRef = React.useRef<{ clear: () => void }>(null);

    useImperativeHandle(ref, () => ({
      clear: () => {
        canvasRef.current?.clear();
      },
    }));

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
          <Canvas ref={canvasRef} tool={tool} color={color} width={width} disabled={disabled} />
        </div>
      </div>
    );
  }
);
