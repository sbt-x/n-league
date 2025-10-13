import React, { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import GuestRoom from "./GuestRoom";
import { setCookie } from "../utils/cookie";

const GuestRoomEnter: React.FC = () => {
  const { roomId: paramRoomId } = useParams<{ roomId?: string }>();
  const [roomId, setRoomId] = useState(paramRoomId ?? "");
  const [userName, setUserName] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [joinInfo, setJoinInfo] = useState<any>(null);
  const [error, setError] = useState("");

  const handleJoinRoom = async () => {
    try {
      const response = await axios.post(
        `http://localhost:3000/rooms/${roomId}/join`,
        {
          name: userName,
        }
      );
      setJoinInfo(response.data);
      setIsJoined(true);
      setError("");
      // memberIdをcookieに保存
      if (response.data?.memberId) {
        setCookie("memberId", response.data.memberId);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "入室に失敗しました");
    }
  };

  if (isJoined && joinInfo) {
    // memberIdをGuestRoomへ渡す
    return <GuestRoom memberId={joinInfo.memberId} />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold mb-4">ゲスト部屋入室</h1>
      {!paramRoomId && (
        <input
          type="text"
          placeholder="部屋IDを入力"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="border p-2 mb-2 rounded"
        />
      )}
      <input
        type="text"
        placeholder="ユーザー名を入力"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        className="border p-2 mb-2 rounded"
      />
      <button
        onClick={handleJoinRoom}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        入室
      </button>
      {error && <div className="mt-4 text-red-600">{error}</div>}
    </div>
  );
};

export default GuestRoomEnter;
