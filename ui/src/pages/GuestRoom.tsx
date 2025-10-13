import React, { useRef } from "react";
import { Whiteboard } from "../features/whiteboard/Whiteboard";
import type { WhiteboardHandle } from "../features/whiteboard/Whiteboard";
import { ReadOnlyWhiteboard } from "../features/whiteboard/ReadOnlyWhiteboard";
import { IconButton } from "../components/IconButton";
import { FaCheck, FaTrash } from "react-icons/fa";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { useParams } from "react-router-dom";

interface GuestRoomProps {
  memberId: string;
}

const GuestRoom: React.FC<GuestRoomProps> = ({ memberId }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const roomState = useRoomSocket(roomId ?? "", memberId);
  // Hostを除外したメンバーリスト
  const members = roomState ? roomState.members.filter((m) => !m.isHost) : [];
  const meId = memberId;
  const whiteboardRef = useRef<WhiteboardHandle>(null);

  return (
    <div className="w-full h-full p-4 flex flex-col gap-4">
      {/* ホスト画面共有エリア - 中央揃え */}
      <div className="flex justify-center flex-1 flex-grow-2">
        <div className="bg-gray-200 rounded-lg border-2 border-dashed border-gray-400 flex items-center justify-center w-full max-w-4xl h-full">
          <div className="text-center">
            <div className="text-xl font-semibold text-gray-600 mb-2">
              ホスト画面共有
            </div>
            <div className="text-sm text-gray-500">16:9 エリア（準備中）</div>
          </div>
        </div>
      </div>

      {/* プレイヤーのWhiteboardエリア - 横並び */}
      <div className="bg-white rounded-lg border border-gray-300 p-4 flex-1 min-h-0 overflow-hidden flex items-center justify-center">
        <div className="flex gap-6 justify-center items-center">
          {members.map((member) => {
            const isMe = member.id === meId;
            return (
              <div
                key={member.id}
                className={`flex flex-col items-center ${isMe ? "w-72 max-w-full" : "w-32 aspect-square"}`}
              >
                <div
                  className={`w-full text-sm mb-2 text-center font-medium select-none ${
                    isMe ? "text-blue-600 font-bold" : "text-gray-600 text-xs"
                  }`}
                >
                  {member.name} {isMe && "(あなた)"}
                </div>
                <div className={`${isMe ? "flex" : "w-full h-full"}`}>
                  <div
                    className={`border flex items-center justify-center ${
                      isMe
                        ? "w-56 h-56 aspect-square border-2 border-blue-400 shadow-lg bg-blue-50"
                        : "w-full h-full border border-gray-200 bg-white"
                    }`}
                  >
                    {isMe ? (
                      <Whiteboard showToolbar={false} ref={whiteboardRef} />
                    ) : (
                      <ReadOnlyWhiteboard />
                    )}
                  </div>
                  {isMe && (
                    <div className="flex flex-col justify-start">
                      <IconButton
                        onClick={() => {
                          // 決定処理
                          console.log("描画内容を決定しました");
                        }}
                        className="bg-green-500 hover:bg-green-600 text-white w-12 h-12 text-lg font-bold shadow-lg transition-all hover:scale-110"
                        border="square"
                      >
                        <FaCheck />
                      </IconButton>
                      <IconButton
                        onClick={() => {
                          whiteboardRef.current?.clear();
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white w-12 h-12 text-lg font-bold shadow-lg transition-all hover:scale-110"
                        border="square"
                      >
                        <FaTrash />
                      </IconButton>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GuestRoom;
