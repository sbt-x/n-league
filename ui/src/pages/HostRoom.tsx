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

type HostRoomProps = {
  roomId?: string;
  memberId?: string;
};

const HostRoom: React.FC<HostRoomProps> = ({ roomId: propRoomId }) => {
  const { roomId: paramRoomId, inviteCode: paramInvite } = useParams<{
    roomId?: string;
    inviteCode?: string;
  }>();
  const roomId = propRoomId ?? paramRoomId ?? paramInvite ?? "";
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
  const { getSocket } = useRoomSocket(roomId ?? "", memberId);
  const [remoteStrokes, setRemoteStrokes] = React.useState<
    Record<string, any[]>
  >({});

  React.useEffect(() => {
    const sock = getSocket ? getSocket() : null;
    if (!sock) return;

    function handleDrawBroadcast(payload: { authorId?: string; stroke: any }) {
      const author = payload?.authorId ?? "unknown";
      setRemoteStrokes((prev) => {
        const copy = { ...prev };
        if (!copy[author]) copy[author] = [];
        copy[author] = [...copy[author], payload.stroke];
        return copy;
      });
    }

    function handleCanvasSync(payload: {
      strokesByAuthor?: Record<string, any[]>;
    }) {
      if (!payload || !payload.strokesByAuthor) return;
      setRemoteStrokes(payload.strokesByAuthor);
    }

    function handleCanvasClear(payload: { authorId?: string }) {
      if (!payload || !payload.authorId) return;
      const author = payload.authorId;
      setRemoteStrokes((prev) => {
        const copy = { ...prev };
        copy[author] = [];
        return copy;
      });
    }

    sock.on("draw:broadcast", handleDrawBroadcast);
    sock.on("canvas:sync:state", handleCanvasSync);
    sock.on("canvas:clear", handleCanvasClear);

    // request current canvas state for this room
    try {
      sock.emit("canvas:sync:request", { roomId });
    } catch (e) {}

    return () => {
      sock.off("draw:broadcast", handleDrawBroadcast);
      sock.off("canvas:sync:state", handleCanvasSync);
    };
  }, [getSocket, roomId]);

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
  // reveal mode: "realtime" = players' answers show immediately,
  // "onDecision" = shown when host presses decision button
  const [editingRevealMode, setEditingRevealMode] = React.useState<
    "realtime" | "onDecision" | undefined
  >(undefined);

  const inviteLink = React.useMemo(() => {
    if (!roomId) return "";
    // link to unified room page
    return `${window.location.origin}/rooms/${roomId}`;
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

  // revealMode is a host-local preference; persist in localStorage per room
  React.useEffect(() => {
    // initialize from localStorage when roomId changes
    try {
      if (!roomId) return;
      const key = `revealMode:${roomId}`;
      const stored = localStorage.getItem(key);
      if (stored === "realtime" || stored === "onDecision") {
        setEditingRevealMode(stored);
      }
    } catch (e) {
      // ignore localStorage errors
    }
  }, [roomId]);

  const handleChangeRevealMode = React.useCallback(
    (mode: "realtime" | "onDecision") => {
      if (!roomId) return;
      setEditingRevealMode(mode);
      try {
        const key = `revealMode:${roomId}`;
        localStorage.setItem(key, mode);
        setSaveError(null);
      } catch (e: any) {
        console.error("failed to save revealMode to localStorage", e);
        setSaveError("設定の保存に失敗しました");
      }
    },
    [roomId]
  );

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
              <div className="text-xs text-gray-500">回答の公開タイミング</div>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="revealMode"
                    value="realtime"
                    checked={
                      (editingRevealMode ??
                        roomState?.revealMode ??
                        "realtime") === "realtime"
                    }
                    onChange={() => handleChangeRevealMode("realtime")}
                  />
                  <span className="text-sm">リアルタイム</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="revealMode"
                    value="onDecision"
                    checked={
                      (editingRevealMode ??
                        roomState?.revealMode ??
                        "realtime") === "onDecision"
                    }
                    onChange={() => handleChangeRevealMode("onDecision")}
                  />
                  <span className="text-sm">送信後</span>
                </label>
                <div className="min-h-[1rem]">
                  {saveError ? (
                    <div className="text-xs text-red-600">{saveError}</div>
                  ) : null}
                </div>
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
                  <div className="w-full mb-2 flex items-center justify-center gap-2">
                    <div className="text-sm font-medium select-none text-blue-600 font-bold">
                      {member.name}
                    </div>
                    {/* inline kick button removed; kick is available inside the whiteboard */}
                  </div>
                  <div className="flex w-full h-full items-center justify-center">
                    <div className="border w-56 h-56 aspect-square border-2 border-blue-400 shadow-lg bg-blue-50 flex items-center justify-center">
                      <ReadOnlyWhiteboard
                        mode={
                          completedMemberIds.includes(memberIdent)
                            ? "star"
                            : "question"
                        }
                        showKickButton={true}
                        onKick={() => handleKick(member)}
                        strokes={remoteStrokes[memberIdent] ?? []}
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
