import React from "react";
import { ReadOnlyCanvas } from "./ReadOnlyCanvas";

export type ReadOnlyWhiteboardProps = {
  showToolbar?: boolean;
  // strokes?: Stroke[]; // 将来的な描画データ
};

export const ReadOnlyWhiteboard: React.FC<ReadOnlyWhiteboardProps> = () => {
  return (
    <div className="flex flex-col w-full h-full bg-gray-50">
      {/* Canvas領域 */}
      <div className="flex-1 w-full h-full">
        <ReadOnlyCanvas mode="question" />
      </div>
    </div>
  );
};
