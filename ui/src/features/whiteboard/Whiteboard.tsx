import React, { useImperativeHandle, forwardRef } from "react";
import { Toolbar } from "./Toolbar";
import { Canvas } from "./Canvas";
import { useTool } from "./hooks/useTool";

export type WhiteboardProps = {
  showToolbar?: boolean;
  isReadOnly?: boolean;
  isDimmed?: boolean;
  onStrokeComplete?: (stroke: any) => void;
  initialStrokes?: any[];
  /** show judgment visualization on this board (for local player's board) */
  judgeMode?: "correct" | "incorrect" | null;
};

export type WhiteboardHandle = {
  clear: () => void;
  loadStrokes?: (s: any[]) => void;
  getSnapshot?: (maxSize?: number) => Promise<string | null>;
};

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(
  (
    {
      showToolbar = false,
      isReadOnly = false,
      isDimmed = false,
      onStrokeComplete,
      initialStrokes,
      judgeMode = null,
    },
    ref
  ) => {
    const { tool, setTool, color, setColor, width, setWidth } = useTool();
    const canvasRef = React.useRef<{
      clear: () => void;
      loadStrokes?: (s: any[]) => void;
      getSnapshot?: (maxSize?: number) => Promise<string | null>;
    }>(null);

    useImperativeHandle(ref, () => ({
      clear: () => {
        canvasRef.current?.clear();
      },
      loadStrokes: (s: any[]) => {
        try {
          canvasRef.current?.loadStrokes?.(s ?? []);
        } catch (e) {
          // ignore
        }
      },
      getSnapshot: async (maxSize = 1024) => {
        try {
          return (await canvasRef.current?.getSnapshot?.(maxSize)) ?? null;
        } catch (e) {
          return null;
        }
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
          <Canvas
            ref={canvasRef}
            tool={tool}
            color={color}
            width={width}
            isReadOnly={isReadOnly}
            isDimmed={isDimmed}
            judgeMode={judgeMode}
            onStrokeComplete={onStrokeComplete}
            initialStrokes={initialStrokes}
          />
        </div>
      </div>
    );
  }
);

Whiteboard.displayName = "Whiteboard";
