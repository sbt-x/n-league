import React, { useState } from "react";
import axios from "axios";
import { getCookie, setCookie } from "../utils/cookie";
import { useNavigate } from "react-router-dom";

const CreateHostRoom: React.FC = () => {
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState<number>(6);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    try {
      let token = getCookie("userJwt");
      if (!token) {
        const t = await axios.get(`${import.meta.env.VITE_API_URL}/token`);
        token = t.data as string;
        if (token) setCookie("userJwt", token);
      }
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/rooms`,
        { name: roomName, maxPeople: maxPlayers },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      console.log("Room created:", response.data);
      // 部屋作成成功時にHostRoomページへ遷移（roomIdをURLに含める）
      navigate(`/host-room/${response.data.roomId}`);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.message || "部屋の作成に失敗しました");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold mb-4">ホスト部屋作成</h1>
      <input
        type="text"
        placeholder="部屋名を入力"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        className="border p-2 mb-2 rounded"
      />
      <input
        type="number"
        placeholder="最大参加人数"
        min={2}
        max={20}
        value={maxPlayers}
        onChange={(e) => setMaxPlayers(Number(e.target.value))}
        className="border p-2 mb-2 rounded"
      />
      <button
        onClick={handleCreateRoom}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        部屋作成
      </button>
      {error && <div className="mt-4 text-red-600">{error}</div>}
    </div>
  );
};

export default CreateHostRoom;
