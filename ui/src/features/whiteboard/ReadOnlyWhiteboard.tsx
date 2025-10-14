import React from "react";
import { ReadOnlyCanvas } from "./ReadOnlyCanvas";

export type ReadOnlyWhiteboardProps = {
  showToolbar?: boolean;
  mode?: "question" | "star";
  strokes?: import("./types/whiteboard").Stroke[];
};

export const ReadOnlyWhiteboard: React.FC<ReadOnlyWhiteboardProps> = ({
  mode = "question",
  strokes = [],
}) => {
  return (
    <div className="flex flex-col w-full h-full bg-gray-50">
      {/* Canvas領域 */}
      <div className="flex-1 w-full h-full">
        <ReadOnlyCanvas mode={mode} strokes={strokes} />
      </div>
    </div>
  );
};
