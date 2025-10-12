import { useState } from "react";
import type { Tool } from "../types/whiteboard.ts";

export function useTool() {
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>("#000000");
  const [width, setWidth] = useState<number>(2);

  return {
    tool,
    setTool,
    color,
    setColor,
    width,
    setWidth,
  };
}
