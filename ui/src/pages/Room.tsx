import React from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { getCookie, setCookie } from "../utils/cookie";
import { jwtDecode } from "jwt-decode";
import HostRoom from "./HostRoom";
import GuestRoom from "./GuestRoom";

const Room: React.FC = () => {
  const { roomId: paramRoomId } = useParams<{ roomId?: string }>();
  const roomId = paramRoomId ?? "";
  const navigate = useNavigate();
  const [memberId, setMemberId] = React.useState<string | null>(null);
  const [isHost, setIsHost] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showNameModal, setShowNameModal] = React.useState(false);
  const [guestName, setGuestName] = React.useState("");
  const [joining, setJoining] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    async function init() {
      // ensure we have a jwt with uuid
      let jwt = getCookie("userJwt");
      if (!jwt) {
        try {
          const t = await axios.get(`${import.meta.env.VITE_API_URL}/token`);
          jwt = t.data as string;
          if (jwt) setCookie("userJwt", jwt);
        } catch (e) {
          // ignore - children will also try to obtain token if needed
        }
      }

      let uuid: string | undefined;
      if (jwt) {
        try {
          const decoded: any = jwtDecode(jwt);
          uuid = decoded?.uuid;
        } catch {
          // ignore
        }
      }

      // fetch room info to determine host (compare UUIDs)
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/rooms/${roomId}`
        );
        const data = res.data;
        const members = data?.members ?? [];
        const hostMember = members.find((m: any) => m.isHost);
        const hostUuid = hostMember?.uuid as string | undefined;
        if (mounted) {
          if (uuid) setMemberId(uuid);
          if (hostUuid && uuid) setIsHost(hostUuid === uuid);
          else setIsHost(false);
        }
        // If we are a guest (not host) and there's no persisted memberId cookie,
        // show name-entry modal so user chooses a display name before joining.
        if (mounted) {
          const hasMemberCookie = Boolean(getCookie("memberId"));
          const isGuest = !hostUuid || (hostUuid && uuid && hostUuid !== uuid);
          if (isGuest && !hasMemberCookie) {
            setShowNameModal(true);
          }
        }
      } catch (e) {
        // If server returns 404, navigate to NotFound page.
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          if (mounted) navigate("/404", { replace: true });
          return;
        }
        if (mounted) {
          // fallback: assume guest if we failed to fetch
          if (uuid) setMemberId(uuid);
          setIsHost(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [roomId]);

  if (loading) return <div className="p-4">読み込み中...</div>;

  return (
    <div className="relative w-full h-full">
      {isHost ? (
        <HostRoom roomId={roomId} memberId={memberId ?? ""} />
      ) : (
        <GuestRoom roomId={roomId} memberId={memberId ?? ""} />
      )}

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
                onClick={() => {
                  // cancel: keep modal open or close? close to allow leaving
                  setShowNameModal(false);
                }}
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
                    const newMemberId = joinRes.data?.memberId as
                      | string
                      | undefined;
                    if (newMemberId) setCookie("memberId", newMemberId);
                    setShowNameModal(false);
                    // notify socket hook to re-join and fetch fresh state
                    try {
                      window.dispatchEvent(
                        new CustomEvent("joinedRoom", { detail: { roomId } })
                      );
                    } catch (e) {
                      // ignore
                    }
                  } catch (e) {
                    console.error("join failed", e);
                    // optionally show an error message here
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
    </div>
  );
};

export default Room;
