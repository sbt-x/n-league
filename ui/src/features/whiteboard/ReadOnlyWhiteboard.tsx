import React from "react";
import { ReadOnlyCanvas } from "./ReadOnlyCanvas";
import { IconButton } from "../../components/IconButton";
import { TbDoorExit } from "react-icons/tb";

export type ReadOnlyWhiteboardProps = {
  showToolbar?: boolean;
  mode?: "question" | "star";
  /** 表示する場合、ホワイトボード内の右上にキックボタンを表示します */
  showKickButton?: boolean;
  /** キックボタンが押されたときに呼ばれるハンドラ（引数なしでOK） */
  onKick?: () => void;
  strokes?: Array<any>;
};

export const ReadOnlyWhiteboard: React.FC<ReadOnlyWhiteboardProps> = ({
  mode = "question",
  showKickButton = false,
  onKick,
  strokes = [],
}) => {
  return (
    <div className="relative flex flex-col w-full h-full bg-gray-50">
      {/* キックボタン（内側右上） */}
      {showKickButton && onKick && (
        <div className="absolute top-2 right-2 z-10">
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onKick();
            }}
            className="bg-red-500 text-white p-2"
            border="rounded"
          >
            <TbDoorExit />
          </IconButton>
        </div>
      )}

      {/* Canvas領域 */}
      <div className="flex-1 w-full h-full">
        <ReadOnlyCanvas mode={mode} strokes={strokes} />
      </div>
    </div>
  );
};

ReadOnlyWhiteboard.displayName = "ReadOnlyWhiteboard";
