import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { getCookie, setCookie } from "../utils/cookie";

const Home: React.FC = () => {
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState<number>(6);
  const navigate = useNavigate();

  const handleJoin = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inviteCode.trim()) {
      setError("招待コードを入力してください");
      return;
    }
    setError("");
    navigate(`/rooms/${encodeURIComponent(inviteCode.trim())}`);
  };

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
      navigate(`/rooms/${response.data.inviteCode}`);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.message || "部屋の作成に失敗しました");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Home Section: make this area fill remaining space and center content vertically */}
      <div className="flex-1 flex items-center">
        <div className="container mx-auto py-8 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full">
            {/* Left: create room (inlined) */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-md bg-white p-6 rounded shadow">
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
              </div>
            </div>

            {/* Right: join by invite code */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-md bg-white p-6 rounded shadow">
                <h2 className="text-2xl font-semibold mb-4 text-center">
                  招待コードで入室
                </h2>
                <form onSubmit={handleJoin} className="flex flex-col">
                  <input
                    type="text"
                    placeholder="招待コードを入力"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="border p-2 mb-3 rounded"
                  />
                  <button
                    type="submit"
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
                  >
                    入室
                  </button>
                  {error && <div className="mt-3 text-red-600">{error}</div>}
                </form>
                <p className="text-sm text-gray-500 mt-4 text-center">
                  招待コードを持っている場合はこちらから入室できます。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
