import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      {/* Grid layout: header (fixed height) / content / footer (fixed height) */}
      <div className="min-h-screen grid grid-rows-[4rem_1fr_3rem]">
        {/* Header */}
        <header className="bg-blue-600 text-white shadow flex items-center px-4 h-16">
          <div className="container mx-auto text-2xl font-semibold">
            Example Page
          </div>
        </header>

        {/* Main Routing: header/footer 行を除いた自動伸長領域 */}
        <main className="bg-gray-100 overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/rooms/:roomId" element={<Room />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-blue-600 text-white flex items-center justify-center h-12">
          &copy; All rights reserved.
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
