import React, { useRef, useState } from "react";
import { Whiteboard } from "../features/whiteboard/Whiteboard";
import type { WhiteboardHandle } from "../features/whiteboard/Whiteboard";
import { ReadOnlyWhiteboard } from "../features/whiteboard/ReadOnlyWhiteboard";
import { IconButton } from "../components/IconButton";
import { FaCheck, FaTrash } from "react-icons/fa";
import { TbCancel } from "react-icons/tb";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { useParams, useNavigate } from "react-router-dom";

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
  const [showNameModal, setShowNameModal] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [joining, setJoining] = useState(false);
  React.useEffect(() => {
    // Determine whether we already have a local identity.
    // Prefer a server-issued JWT uuid when available so the client's identity
    // matches socket authentication. Fall back to a per-device `memberId`
    // cookie only when no valid JWT is present.
    let hasLocalIdentity = false;
    const jwt = getCookie("userJwt");
    if (jwt) {
      try {
        const decoded: any = jwtDecode(jwt);
        if (decoded?.uuid) {
          setMemberId(decoded.uuid);
          hasLocalIdentity = true;
        }
      } catch {
        // invalid jwt - fall back to member cookie or request a new token
      }
    }

    if (!hasLocalIdentity) {
      try {
        const memberCookie = getCookie("memberId");
        if (memberCookie) {
          setMemberId(memberCookie);
          hasLocalIdentity = true;
        }
      } catch {
        // ignore cookie read errors
      }
    }

    // No cookie and no valid JWT -> request a token from the server and use its
    // uuid as our memberId (this creates a persistent identity for sockets).
    if (!hasLocalIdentity) {
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

      // If we reached here there was no member cookie or JWT; show the fallback
      // name modal so a user without any identity can enter a name immediately.
      setShowNameModal(true);
    }
  }, []);

  const { roomState, socket, completedMemberIds, getSocket } = useRoomSocket(
    roomId ?? "",
    memberId
  );
  const navigate = useNavigate();
  // track whether this client was ever observed as a member in the room
  const wasMemberRef = React.useRef(false);
  const [isKicked, setIsKicked] = useState(false);
  // If roomState becomes available, check whether the current memberId (from
  // cookie or token) is already a member of this room. If not, show the name
  // entry modal so the user can be created/added in this room.
  React.useEffect(() => {
    if (!roomState) return;
    // if we don't yet have any local id, keep the modal open
    // Note: memberId may be provided from parent `Room` (UUID from JWT) or
    // restored from cookie; in that case we shouldn't re-open the modal on reload.
    if (!memberId) {
      setShowNameModal(true);
      return;
    }
    const exists = roomState.members.some((m: any) => {
      const ident = (m as any).uuid ?? m.id;
      return ident === memberId;
    });

    // detect if we were previously a member but now removed -> kicked
    if (wasMemberRef.current && !exists) {
      setIsKicked(true);
      // don't show the name-entry modal when kicked; instead show kicked UI
      setShowNameModal(false);
      return;
    }

    // update wasMember flag when we observe the member present
    if (exists) wasMemberRef.current = true;

    // If the current memberId is found among the room members, hide the
    // fallback modal; otherwise show it so the user can join this room.
    setShowNameModal(!exists);
  }, [roomState, memberId]);
  // Hostを除外したメンバーリスト
  const members = roomState ? roomState.members.filter((m) => !m.isHost) : [];
  // normalize phase like HostRoom: default to LOBBY when server omits phase
  const currentPhase = React.useMemo(() => {
    return (roomState as any)?.phase ?? "LOBBY";
  }, [roomState]);
  const meId = memberId;
  const whiteboardRef = useRef<WhiteboardHandle>(null);
  const [isSent, setIsSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Keep local `isSent` in sync with server state for this member.
  // This ensures that after a reload, if the server reports this member as
  // completed, the UI shows the sent/dimmed state instead of the pre-send UI.
  React.useEffect(() => {
    if (!memberId) return;
    const completed = completedMemberIds?.includes(memberId);
    setIsSent(Boolean(completed));
  }, [completedMemberIds, memberId]);

  // respond to server-side canvas clear events (clear all and individual)
  React.useEffect(() => {
    const activeSocket = getSocket ? getSocket() : socket;
    if (!activeSocket) return;

    function handleClearAll() {
      try {
        whiteboardRef.current?.clear?.();
      } catch (e) {}
      // reset sent state
      setIsSent(false);
    }

    function handleAnswersLocked() {
      // if locked, ensure this client is considered sent
      if (!memberId) return;
      if (!completedMemberIds.includes(memberId)) {
        setIsSent(true);
      }
    }

    activeSocket.on("canvas:clearAll", handleClearAll);
    activeSocket.on("answers:locked", handleAnswersLocked);

    return () => {
      activeSocket.off("canvas:clearAll", handleClearAll);
      activeSocket.off("answers:locked", handleAnswersLocked);
    };
  }, [getSocket, socket, memberId, completedMemberIds]);

  // 送信処理
  const handleSend = () => {
    (async () => {
      setIsSending(true);
      try {
        // guard: only allow submission during IN_ROUND
        const currentPhase = (roomState as any)?.phase ?? "LOBBY";
        if (currentPhase !== "IN_ROUND") {
          setIsSending(false);
          return;
        }
        // capture PNG snapshot from whiteboard
        const png = await whiteboardRef.current?.getSnapshot?.(1024);
        const activeSocket = getSocket ? getSocket() : socket;
        if (activeSocket && roomId && png) {
          try {
            activeSocket.emit("submit-snapshot", {
              roomId,
              // include member id so server can map to player
              playerId: memberId,
              snapshot: { pngBase64: png, updatedAt: new Date().toISOString() },
            });
          } catch (e) {
            // ignore emit error
          }
        }

        if (activeSocket && roomId) {
          activeSocket.emit("complete", { roomId });
        }

        setIsSent(true);
      } catch (e) {
        console.error("snapshot/send failed", e);
      } finally {
        setIsSending(false);
      }
    })();
  };

  // Sync canvas state for this member when socket becomes available
  React.useEffect(() => {
    const activeSocket = getSocket ? getSocket() : socket;
    if (!activeSocket || !roomId) return;

    function handleCanvasSync(payload: {
      strokesByAuthor?: Record<string, any[]>;
    }) {
      if (!payload || !payload.strokesByAuthor) return;
      const myKey = memberId ?? "";
      // server stores strokes by author id; try both uuid and id keys
      const strokes = payload.strokesByAuthor[myKey] ?? [];
      try {
        whiteboardRef.current?.loadStrokes?.(strokes);
      } catch (e) {
        // ignore
      }
    }

    activeSocket.on("canvas:sync:state", handleCanvasSync);

    // request initial sync
    try {
      activeSocket.emit("canvas:sync:request", { roomId });
    } catch (e) {
      // ignore
    }

    return () => {
      activeSocket.off("canvas:sync:state", handleCanvasSync);
    };
  }, [getSocket, socket, roomId, memberId]);

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
      {/* kicked modal: shown when server removed this member from room */}
      {isKicked && (
        <div
          className="absolute inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-2">
              ルームから退出しました
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              ホストによってルームから削除されました。ホームへ戻ります。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  try {
                    // navigate to home route
                    navigate("/");
                  } catch (e) {
                    window.location.href = "/";
                  }
                }}
                className="px-4 py-2 rounded bg-blue-500 text-white"
              >
                ホームへ戻る
              </button>
            </div>
          </div>
        </div>
      )}
      {/* fallback name-entry modal (shown if Room didn't show it) */}
      {showNameModal && (
        <div
          className="absolute inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-2">
              参加者名を入力してください
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              この名前がホワイトボード上に表示されます。
            </p>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="表示名を入力"
              className="w-full border px-3 py-2 rounded mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowNameModal(false)}
                disabled={joining}
                className="px-4 py-2 rounded border"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  if (!guestName.trim()) return;
                  setJoining(true);
                  try {
                    const token = getCookie("userJwt");
                    const headers = token
                      ? { Authorization: `Bearer ${token}` }
                      : undefined;
                    const joinRes = await axios.post(
                      `${import.meta.env.VITE_API_URL}/rooms/join`,
                      { inviteCode: roomId, name: guestName.trim() },
                      { headers }
                    );
                    // server now returns memberUuid to uniquely identify the client
                    const newMemberUuid =
                      joinRes.data?.memberUuid ?? joinRes.data?.memberId;
                    if (newMemberUuid) setCookie("memberId", newMemberUuid);
                    setShowNameModal(false);
                    if (newMemberUuid) setMemberId(newMemberUuid);
                    try {
                      window.dispatchEvent(
                        new CustomEvent("joinedRoom", { detail: { roomId } })
                      );
                    } catch (e) {
                      // ignore
                    }
                  } catch (e) {
                    console.error("join failed", e);
                  } finally {
                    setJoining(false);
                  }
                }}
                className="px-4 py-2 rounded bg-blue-500 text-white"
                disabled={joining}
              >
                {joining ? "送信中..." : "参加する"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ホスト画面共有エリア - 中央揃え */}
      <div className="flex justify-center flex-1 flex-grow-2">
        <div className="bg-gray-200 rounded-lg border-2 border-dashed border-gray-400 flex items-center justify-center w-full max-w-4xl h-full">
          {/* show scoreboard at RESULT phase */}
          {currentPhase === "RESULT" ? (
            <div className="p-6 w-full max-w-3xl">
              <h2 className="text-2xl font-bold text-center mb-4">最終結果</h2>
              <div className="bg-white rounded-lg p-4 shadow">
                {(() => {
                  const scoresMap: Record<string, number> =
                    (roomState as any)?.scores ?? {};
                  const membersList = (roomState as any)?.members ?? [];
                  const entries: any[] = membersList
                    .filter((m: any) => !m.isHost)
                    .map((m: any) => {
                      const uuid = m.uuid ?? m.id;
                      return {
                        id: uuid,
                        name: m.name ?? "参加者",
                        isHost: m.isHost,
                        score: scoresMap[uuid] ?? 0,
                      };
                    });
                  entries.sort((a, b) => b.score - a.score);
                  return (
                    <ol className="space-y-2">
                      {entries.map((e: any, idx: number) => (
                        <li
                          key={e.id}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="text-sm font-medium">
                                {e.name}
                              </div>
                              {e.isHost && (
                                <div className="text-xs text-gray-400">
                                  (ホスト)
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-lg font-semibold">{e.score}</div>
                        </li>
                      ))}
                    </ol>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-xl font-semibold text-gray-600 mb-2">
                ホスト画面共有
              </div>
              <div className="text-sm text-gray-500">16:9 エリア（準備中）</div>
            </div>
          )}
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
                        onStrokeComplete={(stroke) => {
                          const activeSocket = getSocket ? getSocket() : socket;
                          if (activeSocket && roomId) {
                            try {
                              activeSocket.emit("draw:stroke", {
                                roomId,
                                stroke,
                              });
                            } catch (e) {
                              // ignore emit errors
                            }
                          }
                        }}
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
                        judgeMode={
                          (roomState as any)?.rounds?.[
                            (roomState as any)?.roundIndex ?? 0
                          ]?.judgments?.[(member as any).uuid ?? member.id] ===
                          true
                            ? "correct"
                            : (roomState as any)?.rounds?.[
                                  (roomState as any)?.roundIndex ?? 0
                                ]?.judgments?.[
                                  (member as any).uuid ?? member.id
                                ] === false
                              ? "incorrect"
                              : null
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
                            disabled={
                              isSending ||
                              (roomState as any)?.phase !== "IN_ROUND"
                            }
                            className={`w-12 h-12 text-lg font-bold shadow-lg transition-all ${isSending ? "animate-pulse opacity-70 bg-green-500 text-white" : (roomState as any)?.phase === "IN_ROUND" ? "bg-green-500 hover:bg-green-600 text-white hover:scale-110" : "bg-gray-300 text-gray-600 cursor-not-allowed"}`}
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
                              // clear local canvas
                              whiteboardRef.current?.clear();
                              // notify host via socket to clear this member's remote strokes
                              const activeSocket = getSocket
                                ? getSocket()
                                : socket;
                              if (activeSocket && roomId) {
                                try {
                                  activeSocket.emit("canvas:clear", {
                                    roomId,
                                    authorId: memberId,
                                  });
                                } catch (e) {
                                  // ignore
                                }
                              }
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white w-12 h-12 text-lg font-bold shadow-lg transition-all hover:scale-110"
                            border="square"
                          >
                            <FaTrash />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          {/* hide cancel button when answers are locked or during reveal */}
                          {!(
                            (roomState as any)?.phase === "LOCKED" ||
                            (roomState as any)?.phase === "REVEAL"
                          ) && (
                            <div className="flex flex-col items-center mb-2">
                              <IconButton
                                onClick={handleCancelSend}
                                className="bg-yellow-400 hover:bg-yellow-500 text-white w-12 h-12 text-lg font-bold shadow-lg transition-all hover:scale-110"
                                border="square"
                              >
                                <TbCancel />
                              </IconButton>
                            </div>
                          )}
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
