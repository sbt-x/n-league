import React, { useRef, useEffect, useState } from "react";

type ReadOnlyCanvasProps = {
  mode?: "question" | "star";
};

export const ReadOnlyCanvas: React.FC<ReadOnlyCanvasProps> = ({
  mode = "question",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  // Resize canvas to match parent size
  useEffect(() => {
    function resizeCanvas() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // モードによって描画を切り替え
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (mode === "question") {
      // 青背景
      ctx.fillStyle = "#3490dc";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // 文字
      ctx.font = "bold 48px sans-serif";
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", canvas.width / 2, canvas.height / 2);
    } else if (mode === "star") {
      // 白背景
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // 星を中央に描画
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const spikes = 5;
      const outerRadius = Math.min(canvas.width, canvas.height) / 4;
      const innerRadius = outerRadius / 2.5;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (Math.PI / spikes) * i;
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        ctx.lineTo(
          cx + Math.cos(angle - Math.PI / 2) * r,
          cy + Math.sin(angle - Math.PI / 2) * r
        );
      }
      ctx.closePath();
      ctx.fillStyle = "#facc15"; // tailwind yellow-400
      ctx.fill();
      ctx.restore();
    }
  }, [canvasSize, mode]);

  return (
    <div className="flex flex-col h-full w-full">
      <div ref={containerRef} className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="border border-gray-300 bg-white w-full h-full block"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
};

ReadOnlyCanvas.displayName = "ReadOnlyCanvas";
