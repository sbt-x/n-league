import React, { useRef, useState } from "react";
import { Whiteboard } from "../features/whiteboard/Whiteboard";
import type { WhiteboardHandle } from "../features/whiteboard/Whiteboard";
import { ReadOnlyWhiteboard } from "../features/whiteboard/ReadOnlyWhiteboard";
import { IconButton } from "../components/IconButton";
import { FaCheck, FaTrash } from "react-icons/fa";
import { TbCancel } from "react-icons/tb";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { useParams } from "react-router-dom";

import { getCookie, setCookie } from "../utils/cookie";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

type GuestRoomProps = {
  roomId?: string;
  memberId?: string;
};

const GuestRoom: React.FC<GuestRoomProps> = ({
  roomId: propRoomId,
  memberId: propMemberId,
}) => {
  const { roomId: paramRoomId, inviteCode: paramInvite } = useParams<{
    roomId?: string;
    inviteCode?: string;
  }>();
  const roomId = propRoomId ?? paramRoomId ?? paramInvite ?? "";
  const [memberId, setMemberId] = useState<string>(propMemberId ?? "");
  React.useEffect(() => {
    const jwt = getCookie("userJwt");
    if (jwt) {
      try {
        const decoded: any = jwtDecode(jwt);
        setMemberId(decoded.uuid);
        return;
      } catch {
        // 取得できなかった場合はトークンを再取得
      }
    }
    // 初回アクセスまたは不正な JWT の場合は API から JWT を取得
    axios.get(`${import.meta.env.VITE_API_URL}/token`).then((res) => {
      const token = res.data as string;
      setCookie("userJwt", token);
      try {
        const decoded: any = jwtDecode(token);
        if (decoded?.uuid) setMemberId(decoded.uuid);
      } catch {
        // ignore decode error
      }
    });
  }, []);
  const { roomState, socket, completedMemberIds } = useRoomSocket(
    roomId ?? "",
    memberId
  );
  // Hostを除外したメンバーリスト
  const members = roomState ? roomState.members.filter((m) => !m.isHost) : [];
  const meId = memberId;
  const whiteboardRef = useRef<WhiteboardHandle>(null);
  const [isSent, setIsSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 送信処理
  const handleSend = () => {
    setIsSending(true);
    if (socket && roomId) {
      socket.emit("complete", { roomId });
    }
    setIsSending(false);
    setIsSent(true);
  };

  // 送信取り消し
  const handleCancelSend = () => {
    console.log(
      "Cancelling completion for memberId:",
      memberId,
      "roomId:",
      roomId
    );
    setIsSent(false);
    // 必要ならサーバーに取り消しイベント送信
    if (socket && roomId) {
      socket.emit("cancelComplete", { roomId });
    }
  };

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
            // identify member by uuid when available, fallback to id
            const memberIdent = (member as any).uuid ?? member.id;
            const isMe = memberIdent === meId;
            return (
              <div
                key={member.id}
                className={`flex flex-col items-center ${isMe ? "w-72 max-w-full" : "w-32 aspect-square"}`}
              >
                <div
                  className={`w-full text-sm mb-2 text-center font-medium select-none ${
                    isMe
                      ? "text-blue-600 font-bold"
                      : completedMemberIds.includes(
                            (member as any).uuid ?? member.id
                          )
                        ? "text-green-600 font-bold text-xs"
                        : "text-gray-600 text-xs"
                  }`}
                >
                  {member.name} {isMe && "(あなた)"}{" "}
                  {!isMe &&
                    completedMemberIds.includes(
                      (member as any).uuid ?? member.id
                    ) &&
                    "✓"}
                </div>
                <div className={`${isMe ? "flex" : "w-full h-full"}`}>
                  <div
                    className={`border flex items-center justify-center ${
                      isMe
                        ? "w-56 h-56 aspect-square border-2 border-blue-400 shadow-lg bg-blue-50"
                        : `w-full h-full border-2 ${
                            completedMemberIds.includes(
                              (member as any).uuid ?? member.id
                            )
                              ? "border-green-400 bg-green-50"
                              : "border-gray-200 bg-white"
                          }`
                    }`}
                  >
                    {isMe ? (
                      <Whiteboard
                        showToolbar={false}
                        ref={whiteboardRef}
                        isReadOnly={isSent}
                        isDimmed={isSent}
                      />
                    ) : (
                      <ReadOnlyWhiteboard
                        mode={
                          completedMemberIds.includes(
                            (member as any).uuid ?? member.id
                          )
                            ? "star"
                            : "question"
                        }
                      />
                    )}
                  </div>
                  {isMe && (
                    <div className="flex flex-col justify-start">
                      {!isSent ? (
                        <>
                          <IconButton
                            onClick={handleSend}
                            disabled={isSending}
                            className={`bg-green-500 hover:bg-green-600 text-white w-12 h-12 text-lg font-bold shadow-lg transition-all ${isSending ? "animate-pulse opacity-70" : "hover:scale-110"}`}
                            border="square"
                          >
                            {isSending ? (
                              <span className="animate-spin">⏳</span>
                            ) : (
                              <FaCheck />
                            )}
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
                        </>
                      ) : (
                        <>
                          <div className="flex flex-col items-center mb-2">
                            <IconButton
                              onClick={handleCancelSend}
                              className="bg-yellow-400 hover:bg-yellow-500 text-white w-12 h-12 text-lg font-bold shadow-lg transition-all hover:scale-110"
                              border="square"
                            >
                              <TbCancel />
                            </IconButton>
                          </div>
                        </>
                      )}
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
