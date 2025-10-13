import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import GuestRoom from "./pages/GuestRoom";
import GuestRoomEnter from "./pages/GuestRoomEnter";
import CreateHostRoom from "./pages/CreateHostRoom";
import HostRoom from "./pages/HostRoom";

function App() {
  return (
    <BrowserRouter>
      <div className="h-screen flex flex-col">
        {/* Header: 固定 */}
        <header className="bg-blue-600 text-white p-4 shadow fixed top-0 left-0 w-full z-10">
          <div className="container mx-auto text-2xl font-semibold">
            Example Page
          </div>
        </header>

        {/* Main Routing: ヘッダー・フッター分の高さを除外 */}
        <main className="flex-1 bg-gray-100 pt-20 pb-8 h-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/guest-room"
              element={<GuestRoom myPosition={4} totalPlayers={6} />}
            />
            <Route
              path="/guest-room-enter/:roomId"
              element={<GuestRoomEnter />}
            />
            <Route path="/create-host-room" element={<CreateHostRoom />} />
            <Route path="/host-room/:roomId" element={<HostRoom />} />
          </Routes>
        </main>

        {/* Footer: 固定 */}
        <footer className="bg-blue-600 text-white text-center py-2 fixed bottom-0 left-0 w-full z-10">
          &copy; All rights reserved.
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
