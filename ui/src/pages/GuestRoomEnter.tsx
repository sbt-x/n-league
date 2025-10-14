import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { setCookie } from "../utils/cookie";

const GuestRoomEnter: React.FC = () => {
  const { roomId: paramRoomId } = useParams<{ roomId?: string }>();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState(paramRoomId ?? "");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState("");

  const handleJoinRoom = async () => {
    try {
      const response = await axios.post(
        `http://localhost:3000/rooms/${roomId}/join`,
        {
          name: userName,
        }
      );
      setError("");
      // memberIdをcookieに保存
      if (response.data?.memberId) {
        setCookie("memberId", response.data.memberId);
      }
      navigate(`/rooms/guest-room/${roomId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || "入室に失敗しました");
    }
  };

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
