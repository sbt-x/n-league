import React from "react";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { useParams } from "react-router-dom";

const HostRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const roomState = useRoomSocket(roomId ?? "");
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold mb-4">ホスト部屋</h1>
      <p>部屋が作成されました。ここにホスト用の機能や情報を追加できます。</p>
      <div className="mt-4 text-lg">
        現在の人数: {roomState ? roomState.members.length : "取得中..."}
      </div>
    </div>
  );
};

export default HostRoom;
