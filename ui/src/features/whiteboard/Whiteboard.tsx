import React, { useImperativeHandle, forwardRef } from "react";
import { Toolbar } from "./Toolbar.tsx";
import { Canvas } from "./Canvas.tsx";
import { useTool } from "./hooks/useTool.ts";

export type WhiteboardProps = {
  showToolbar?: boolean;
  isReadOnly?: boolean;
};

export type WhiteboardHandle = {
  clear: () => void;
};

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(
  ({ showToolbar = false, isReadOnly = false }, ref) => {
    const { tool, setTool, color, setColor, width, setWidth } = useTool();
    const canvasRef = React.useRef<{ clear: () => void }>(null);

    useImperativeHandle(ref, () => ({
      clear: () => {
        canvasRef.current?.clear();
      },
    }));

    return (
      <div className="flex flex-col w-full h-full bg-gray-50 relative">
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
        <div className="flex-1 w-full h-full relative">
          <Canvas ref={canvasRef} tool={tool} color={color} width={width} />
          {isReadOnly && (
            <div className="absolute inset-0 bg-gray-700 bg-opacity-40 flex items-center justify-center pointer-events-auto z-10">
              <span className="text-white text-lg font-bold">
                編集できません
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
);
