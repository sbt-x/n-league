import React from "react";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { getCookie, setCookie } from "../utils/cookie";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { useParams } from "react-router-dom";
import { ReadOnlyWhiteboard } from "../features/whiteboard/ReadOnlyWhiteboard";

const HostRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  // memberId: prefer server-issued memberId cookie, fallback to jwt.uuid
  const [memberId, setMemberId] = React.useState<string>("");
  React.useEffect(() => {
    const mid = getCookie("memberId");
    if (mid) {
      setMemberId(mid);
      return;
    }
    const jwt = getCookie("userJwt");
    if (jwt) {
      try {
        const decoded: any = jwtDecode(jwt);
        setMemberId(decoded.uuid);
      } catch {
        setMemberId("");
      }
    } else {
      // 初回アクセス時はAPIからJWT取得
      axios.get(`${import.meta.env.VITE_API_URL}/token`).then((res) => {
        const { token, uuid } = res.data;
        setCookie("userJwt", token);
        setMemberId(uuid);
      });
    }
  }, []);
  const { roomState, completedMemberIds } = useRoomSocket(
    roomId ?? "",
    memberId
  );

  // 人数取得
  const members = roomState ? roomState.members : [];

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

      {/* プレイヤーのWhiteboardエリア - 横並び（ホスト+ゲスト） */}
      <div className="bg-white rounded-lg border border-gray-300 p-4 flex-1 min-h-0 overflow-hidden flex items-center justify-center">
        <div className="flex gap-6 justify-center items-center">
          {/* ホストは表示しない。ゲスト分のReadOnlyWhiteboardのみ横並びで表示 */}
          {members
            .filter((m) => !m.isHost)
            .map((member) => (
              <div
                key={member.id}
                className="flex flex-col items-center w-72 max-w-full"
              >
                <div className="w-full text-sm mb-2 text-center font-medium select-none text-blue-600 font-bold">
                  {member.name}
                </div>
                <div className="flex w-full h-full items-center justify-center">
                  <div className="border w-56 h-56 aspect-square border-2 border-blue-400 shadow-lg bg-blue-50 flex items-center justify-center">
                    <ReadOnlyWhiteboard
                      mode={
                        completedMemberIds.includes(member.id)
                          ? "star"
                          : "question"
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default HostRoom;
