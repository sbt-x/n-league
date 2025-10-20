import React from "react";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { getCookie, setCookie } from "../utils/cookie";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { useParams } from "react-router-dom";
import { ReadOnlyWhiteboard } from "../features/whiteboard/ReadOnlyWhiteboard";
import { IconButton } from "../components/IconButton";
import { FaClipboard, FaCheck } from "react-icons/fa6";

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

  const [copied, setCopied] = React.useState(false);
  const [editingMax, setEditingMax] = React.useState<number | undefined>(
    undefined
  );
  const [savingMax, setSavingMax] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const inviteLink = React.useMemo(() => {
    if (!roomId) return "";
    // link to guest entry page
    return `${window.location.origin}/rooms/guest-room-enter/${roomId}`;
  }, [roomId]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("クリップボードへのコピーに失敗しました", e);
    }
  };

  return (
    <div className="w-full h-full p-4 flex flex-col gap-4">
      {/* ホスト画面共有エリア - 右側に設定パネルを配置 */}
      <div className="flex flex-1 flex-grow-2 gap-4">
        <div className="flex-1 flex justify-center">
          <div className="bg-gray-200 rounded-lg border-2 border-dashed border-gray-400 flex items-center justify-center w-full max-w-4xl h-full">
            <div className="text-center">
              <div className="text-xl font-semibold text-gray-600 mb-2">
                ホスト画面共有
              </div>
              <div className="text-sm text-gray-500">16:9 エリア（準備中）</div>
            </div>
          </div>
        </div>

        {/* 右側設定パネル */}
        <aside className="w-80">
          <div className="bg-white rounded-lg border border-gray-300 p-4 h-full flex flex-col gap-3">
            <div className="text-lg font-semibold">部屋設定</div>

            <div>
              <div className="text-xs text-gray-500">部屋名</div>
              <div className="text-sm font-medium text-gray-700 break-words">
                {roomState?.roomId ?? roomId ?? "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">
                最大人数（ホスト除く）
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={editingMax ?? roomState?.maxPlayers ?? 6}
                  onChange={(e) => setEditingMax(Number(e.target.value))}
                  className="w-20 border px-2 py-1 rounded text-sm"
                />
                <IconButton
                  onClick={(e) => {
                    e.preventDefault();
                    if (!savingMax) {
                      (async () => {
                        if (!roomId) return;
                        const max = editingMax ?? roomState?.maxPlayers;
                        if (typeof max !== "number") return;
                        setSavingMax(true);
                        try {
                          const token = getCookie("userJwt");
                          await axios.patch(
                            `${import.meta.env.VITE_API_URL}/rooms/${roomId}`,
                            { maxPlayers: max },
                            {
                              headers: token
                                ? { Authorization: `Bearer ${token}` }
                                : undefined,
                            }
                          );
                          setSaveSuccess("保存しました");
                          setSaveError(null);
                          setTimeout(() => setSaveSuccess(null), 2000);
                          setEditingMax(max);
                        } catch (e: any) {
                          console.error(e);
                          const serverMsg = e?.response?.data?.message;
                          if (serverMsg) {
                            setSaveError(serverMsg);
                          } else {
                            setSaveError("保存に失敗しました");
                          }
                          setSaveSuccess(null);
                        } finally {
                          setSavingMax(false);
                        }
                      })();
                    }
                  }}
                  className="bg-blue-500 text-white p-2"
                  border="rounded"
                  disabled={savingMax}
                >
                  <FaCheck />
                </IconButton>
                {saveSuccess && (
                  <div className="text-xs text-green-600">{saveSuccess}</div>
                )}
                {saveError && (
                  <div className="text-xs text-red-600">{saveError}</div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">招待URL</div>
              <div className="flex gap-2 items-center">
                <input
                  readOnly
                  value={inviteLink}
                  title={inviteLink}
                  className="flex-1 border px-2 py-1 rounded text-sm text-gray-700 bg-gray-50 truncate"
                  style={{ minWidth: 0 }}
                />
                <IconButton
                  onClick={() => handleCopyLink()}
                  className="bg-blue-500 text-white p-2"
                  border="rounded"
                >
                  <FaClipboard />
                </IconButton>
              </div>
              {copied && (
                <div className="text-xs text-green-600 mt-1">
                  コピーしました
                </div>
              )}
            </div>

            <div className="mt-auto text-xs text-gray-400">
              招待リンクは参加者がゲスト入室ページで使用します
            </div>
          </div>
        </aside>
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
