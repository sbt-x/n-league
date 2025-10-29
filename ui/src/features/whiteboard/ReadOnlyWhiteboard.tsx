import React from "react";
import { ReadOnlyCanvas } from "./ReadOnlyCanvas";
import { IconButton } from "../../components/IconButton";
import { TbDoorExit } from "react-icons/tb";
import { FaRegCircle, FaXmark } from "react-icons/fa6";

export type ReadOnlyWhiteboardProps = {
  showToolbar?: boolean;
  mode?: "question" | "star";
  /** 表示する場合、ホワイトボード内の右上にキックボタンを表示します */
  showKickButton?: boolean;
  /** キックボタンが押されたときに呼ばれるハンドラ（引数なしでOK） */
  onKick?: () => void;
  strokes?: Array<any>;
  /** show judge buttons (correct/incorrect) inside the whiteboard (right side) */
  showJudgeButtons?: boolean;
  /** current judge visualization mode */
  judgeMode?: "correct" | "incorrect" | null;
  /** called when host presses judge button */
  onJudge?: (correct: boolean) => void;
};

export const ReadOnlyWhiteboard: React.FC<ReadOnlyWhiteboardProps> = ({
  mode = "question",
  showKickButton = false,
  onKick,
  strokes = [],
  showJudgeButtons = false,
  onJudge,
  judgeMode = null,
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

      {/* Judge buttons (内側右下) */}
      {showJudgeButtons && (
        <div className="absolute bottom-2 right-2 z-10 flex gap-2">
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onJudge?.(true);
            }}
            className={`p-2 border border-gray-200 shadow-sm rounded ${
              judgeMode === "correct"
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            border="rounded"
          >
            <FaRegCircle className="w-5 h-5" />
          </IconButton>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onJudge?.(false);
            }}
            className={`p-2 border border-gray-200 shadow-sm rounded ${
              judgeMode === "incorrect"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            border="rounded"
          >
            <FaXmark className="w-5 h-5" />
          </IconButton>
        </div>
      )}

      {/* Canvas領域 */}
      <div className="flex-1 w-full h-full">
        <ReadOnlyCanvas mode={mode} strokes={strokes} judgeMode={judgeMode} />
      </div>
    </div>
  );
};

ReadOnlyWhiteboard.displayName = "ReadOnlyWhiteboard";
