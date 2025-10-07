import React from "react";

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="container mx-auto py-20 text-center">
        <h1 className="text-5xl font-bold mb-6 text-gray-800">
          Vite + React + Tailwind CSS
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          This is a simple example of a React page styled with Tailwind CSS.
        </p>
        <button className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
          If this button is blue, Tailwind is working!
        </button>
      </section>
    </div>
  );
}

export default App;
