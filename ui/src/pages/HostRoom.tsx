import React from "react";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { getCookie, setCookie } from "../utils/cookie";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { useParams } from "react-router-dom";
import { ReadOnlyWhiteboard } from "../features/whiteboard/ReadOnlyWhiteboard";

type Member = { id: string; name?: string; isHost?: boolean; uuid?: string };
type DecodedJwt = { uuid?: string; exp?: number } & Record<string, any>;

const HostRoom: React.FC = () => {
  const { inviteCode: roomId } = useParams<{ inviteCode: string }>();
  // userJwt cookie から memberId を取得。なければサーバーに新しいトークンをリクエスト
  const [memberId, setMemberId] = React.useState<string>("");

  React.useEffect(() => {
    async function initJwt() {
      const jwt = getCookie("userJwt");
      if (jwt) {
        // CookieにJWTが存在する場合はデコードしてmemberIdを取得
        try {
          const decoded = jwtDecode(jwt) as DecodedJwt;
          const uuid = decoded?.uuid;
          const exp = decoded?.exp;
          // exp は JWT 仕様で epoch seconds
          if (exp && Date.now() >= exp * 1000) {
            console.info("JWT は期限切れです。新しいトークンを取得します。");
          } else if (uuid) {
            setMemberId(uuid);
            return;
          }
        } catch {
          // デコードに失敗した場合はWarningを出力してトークンを再取得
          console.warn(
            "JWTのデコードに失敗しました。新しいトークンを取得します。"
          );
        }
      }
      try {
        // 初回アクセスまたは不正な JWT の場合は API から JWT を取得
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/token`);
        const token = res.data as string;
        if (token) {
          setCookie("userJwt", token);
          try {
            const decoded = jwtDecode(token) as DecodedJwt;
            const uuidFromToken = decoded?.uuid;
            const expFromToken = decoded?.exp;
            if (uuidFromToken) setMemberId(uuidFromToken);
            if (expFromToken && Date.now() >= expFromToken * 1000) {
              console.warn("サーバーから受け取ったトークンが期限切れです");
            }
          } catch {
            // decode に失敗しても他の処理には影響しない
          }
        }
      } catch (error) {
        console.error("トークンの取得に失敗しました:", error);
      }
    }
    initJwt();
  }, []);

  const { roomState, completedMemberIds } = useRoomSocket(
    roomId ?? "",
    memberId
  );

  // Hostを含む全メンバーリスト
  const members = roomState ? roomState.members : [];

  /**
   * メンバーをキックする
   *
   * @param member キックするメンバー情報
   */
  const handleKick = React.useCallback(
    async (member: Member) => {
      if (!roomId || !roomState?.hostId) return;
      const token = getCookie("userJwt");
      if (!token) return;

      await axios.post(
        `${import.meta.env.VITE_API_URL}/rooms/${roomId}/kick`,
        { hostId: roomState.hostId, memberUuid: member.uuid },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    [roomId, roomState?.hostId]
  );

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
            .map((member) => {
              const memberIdent = (member as any).uuid ?? member.id;
              return (
                <div
                  key={member.id}
                  className="flex flex-col items-center w-72 max-w-full"
                >
                  <div className="w-full text-sm mb-2 text-center font-medium select-none text-blue-600 font-bold">
                    {member.name}
                  </div>
                  <div className="w-full flex justify-center mb-2">
                    <button
                      className="text-xs bg-red-500 text-white px-2 py-1 rounded"
                      onClick={() => handleKick(member)}
                    >
                      キック
                    </button>
                  </div>
                  <div className="flex w-full h-full items-center justify-center">
                    <div className="border w-56 h-56 aspect-square border-2 border-blue-400 shadow-lg bg-blue-50 flex items-center justify-center">
                      <ReadOnlyWhiteboard
                        mode={
                          completedMemberIds.includes(memberIdent)
                            ? "star"
                            : "question"
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default HostRoom;
