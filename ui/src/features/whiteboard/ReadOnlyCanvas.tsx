import React, { useRef, useEffect, useState } from "react";

type ReadOnlyCanvasProps = {
  mode?: "question" | "star";
  strokes?: Array<any>;
  /** when set, visualizes judgment: 'correct' -> red bg, 'incorrect' -> blue bg and invert black strokes to white */
  judgeMode?: "correct" | "incorrect" | null;
};

export const ReadOnlyCanvas: React.FC<ReadOnlyCanvasProps> = ({
  mode = "question",
  strokes = [],
  judgeMode = null,
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
    // If judgeMode is set, draw colored background accordingly
    if (judgeMode === "correct") {
      // more vivid red (tailwind red-500)
      ctx.fillStyle = "#ef4444"; // red-500
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (judgeMode === "incorrect") {
      // more vivid blue (tailwind blue-500)
      ctx.fillStyle = "#3b82f6"; // blue-500
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (mode === "question") {
      // default question background (blue)
      ctx.fillStyle = "#3490dc";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // 文字
      ctx.font = "bold 48px sans-serif";
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", canvas.width / 2, canvas.height / 2);
    } else if (mode === "star") {
      // white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // star drawing
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
    // If strokes provided, render them on top of the mode background (simple replay)
    if (strokes && strokes.length > 0) {
      strokes.forEach((stroke: any) => {
        if (!stroke || !stroke.points || stroke.points.length < 1) return;
        ctx.beginPath();
        // when judged, invert black strokes to white
        const strokeColorRaw = stroke.color || "#000";
        let strokeColor = strokeColorRaw;
        if (
          judgeMode &&
          (strokeColorRaw === "#000" || strokeColorRaw === "black")
        ) {
          strokeColor = "#fff";
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = stroke.width || 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (stroke.tool === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
        } else {
          ctx.globalCompositeOperation = "source-over";
        }
        // If metadata contains the source canvas size, scale+center the stroke
        const meta = stroke.metadata;
        let transformPoint = (p: any) => ({ x: p.x, y: p.y });
        if (meta && meta.canvasWidth > 0 && meta.canvasHeight > 0) {
          const srcW = meta.canvasWidth;
          const srcH = meta.canvasHeight;
          const dstW = canvas.width;
          const dstH = canvas.height;
          // uniform scale to fit
          const scale = Math.min(dstW / srcW, dstH / srcH);
          const scaledW = srcW * scale;
          const scaledH = srcH * scale;
          // center the scaled drawing within destination canvas
          const offsetX = (dstW - scaledW) / 2;
          const offsetY = (dstH - scaledH) / 2;
          transformPoint = (p: any) => ({
            x: Math.round(p.x * scale + offsetX),
            y: Math.round(p.y * scale + offsetY),
          });
        }

        const p0 = transformPoint(stroke.points[0]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < stroke.points.length; i++) {
          const pt = transformPoint(stroke.points[i]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      });
    }
  }, [canvasSize, mode, strokes]);

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
