import React, {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";

import { useDraw } from "./hooks/useDraw.ts";
import type { Point, Stroke, Tool } from "./types/whiteboard.ts";
import { assertNever } from "../../utils/types.ts";

export type CanvasProps = {
  tool: Tool;
  color: string;
  width: number;
  disabled?: boolean;
  onClear?: () => void;
  onUndo?: () => void;
};

export type CanvasHandle = {
  clear: () => void;
};

  ({ tool, color, width, disabled = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // オフスクリーンキャンバスで既存ストロークをキャッシュ
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const lastRenderedStrokeCount = useRef(0);
    // requestAnimationFrameのスロットリング用
    const rafIdRef = useRef<number | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
    const [isHovered, setIsHovered] = useState(false);
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
  
    // オフスクリーンキャンバスの初期化とリサイズ
    useEffect(() => {
      if (canvasSize.width > 0 && canvasSize.height > 0) {
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement("canvas");
        }
        offscreenCanvasRef.current.width = canvasSize.width;
        offscreenCanvasRef.current.height = canvasSize.height;
        // リサイズ時はキャッシュをクリアして再描画
        lastRenderedStrokeCount.current = 0;
      }
    }, [canvasSize]);
  
    const {
      strokes,
      isDrawing,
      startDrawing,
      continueDrawing,
      endDrawing,
      clearCanvas,
    } = useDraw({
      tool,
      color,
      width,
    });
  
    // Canvas rendering effect - 最適化版
    useEffect(() => {
      const canvas = canvasRef.current;
      const offscreenCanvas = offscreenCanvasRef.current;
      if (!canvas || !offscreenCanvas) return;
  
      const ctx = canvas.getContext("2d");
      const offscreenCtx = offscreenCanvas.getContext("2d");
      if (!ctx || !offscreenCtx) return;
  
      // ストロークが空の場合は両方のキャンバスをクリア
      if (strokes.length === 0) {
        offscreenCtx.clearRect(
          0,
          0,
          offscreenCanvas.width,
          offscreenCanvas.height
        );
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        lastRenderedStrokeCount.current = 0;
        return;
      }
  
      // Undo処理：ストローク数が減った場合は全体を再描画
      if (strokes.length < lastRenderedStrokeCount.current) {
        offscreenCtx.clearRect(
          0,
          0,
          offscreenCanvas.width,
          offscreenCanvas.height
        );
  
        // 全ストロークを再描画
        strokes.forEach((stroke: Stroke) => {
          if (!stroke || !stroke.points || stroke.points.length < 1) return;
  
          offscreenCtx.beginPath();
          offscreenCtx.strokeStyle = stroke.color;
          offscreenCtx.lineWidth = stroke.width;
          offscreenCtx.lineCap = "round";
          offscreenCtx.lineJoin = "round";
  
          if (stroke.tool === "eraser") {
            offscreenCtx.globalCompositeOperation = "destination-out";
          } else if (stroke.tool === "pen") {
            offscreenCtx.globalCompositeOperation = "source-over";
          } else {
            assertNever(stroke.tool);
          }
  
          offscreenCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            offscreenCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          offscreenCtx.stroke();
  
          // globalCompositeOperationをリセット
          offscreenCtx.globalCompositeOperation = "source-over";
        });
  
        lastRenderedStrokeCount.current = strokes.length;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(offscreenCanvas, 0, 0);
        return;
      }
  
      // 描画中のストローク（最後のストローク）と完成したストロークを分けて処理
      const completedStrokesCount = isDrawing
        ? strokes.length - 1
        : strokes.length;
      const newCompletedStrokes = strokes.slice(
        lastRenderedStrokeCount.current,
        completedStrokesCount
      );
  
      // 新しく完成したストロークをオフスクリーンキャンバスに描画
      if (newCompletedStrokes.length > 0) {
        newCompletedStrokes.forEach((stroke: Stroke) => {
          // 防御的チェック: strokeとpointsが存在することを確認
          if (!stroke || !stroke.points || stroke.points.length < 1) return;
  
          offscreenCtx.beginPath();
          offscreenCtx.strokeStyle = stroke.color;
          offscreenCtx.lineWidth = stroke.width;
          offscreenCtx.lineCap = "round";
          offscreenCtx.lineJoin = "round";
  
          if (stroke.tool === "eraser") {
            offscreenCtx.globalCompositeOperation = "destination-out";
          } else {
            offscreenCtx.globalCompositeOperation = "source-over";
          }
  
          offscreenCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            offscreenCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          offscreenCtx.stroke();
  
          // globalCompositeOperationをリセット
          // TODO: これを毎回リセットする必要があるか検討、現状はないとcanvas全体が透明になる
          offscreenCtx.globalCompositeOperation = "source-over";
        });
  
        // 描画済みのストローク数を更新
        lastRenderedStrokeCount.current = completedStrokesCount;
      }
  
      // メインキャンバスをクリアしてオフスクリーンキャンバスをコピー
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreenCanvas, 0, 0);
  
      // 描画中のストロークがあれば、メインキャンバスに描画
      if (isDrawing && strokes.length > 0) {
        const currentStroke = strokes[strokes.length - 1];
        const points = currentStroke.points;
  
        if (points.length > 1) {
          ctx.strokeStyle = currentStroke.color;
          ctx.lineWidth = currentStroke.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
  
          if (currentStroke.tool === "eraser") {
            ctx.globalCompositeOperation = "destination-out";
          } else {
            ctx.globalCompositeOperation = "source-over";
          }
  
          // 描画中のストロークを全体描画（オフスクリーンキャンバスの上に重ねる）
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
  
          // globalCompositeOperationをリセット
          ctx.globalCompositeOperation = "source-over";
        }
      }
    }, [strokes, isDrawing]);
  
    function handlePointerDown(e: React.PointerEvent) {
      if (disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
  
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
  
      startDrawing({ x, y });
    }
  
    function handlePointerMove(e: React.PointerEvent) {
      if (disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
  
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
  
      // Update cursor position for custom cursor
      setCursorPosition({ x, y });
  
      // Continue drawing if currently drawing - requestAnimationFrameでスロットリング
      if (isDrawing) {
        // 前のフレームをキャンセル
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }
  
        // 次のフレームで描画
        rafIdRef.current = requestAnimationFrame(() => {
          continueDrawing({ x, y });
          rafIdRef.current = null;
        });
      }
    }
  
    function handlePointerUp() {
      if (disabled) return;
      // クリーンアップ
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      endDrawing();
    }
  
    function handlePointerEnter() {
      setIsHovered(true);
    }
  
    function handlePointerLeave() {
      setIsHovered(false);
      setCursorPosition(null);
      // ポインターがcanvas外に出たら描画終了
      if (isDrawing) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        endDrawing();
      }
    }
  
    useImperativeHandle(ref, () => ({
      clear: () => {
        clearCanvas();
      },
    }));
  
    return (
      <div className="flex flex-col h-full w-full">
        <div ref={containerRef} className="relative w-full h-full">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="border border-gray-300 bg-white cursor-none w-full h-full block"
            style={{ width: "100%", height: "100%" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
          />
          {/* Custom Cursor */}
          {isHovered && cursorPosition && (
            <div
              className="absolute pointer-events-none border-2 rounded-full"
              style={{
                left: cursorPosition.x - width / 2,
                top: cursorPosition.y - width / 2,
                width: width,
                height: width,
                borderColor: tool === "eraser" ? "#ff0000" : color,
                backgroundColor:
                  tool === "eraser" ? "#ff00001a" : "transparent",
              }}
            />
          )}
        </div>
      </div>
    );
  }
);
    const containerRef = useRef<HTMLDivElement>(null);
    // オフスクリーンキャンバスで既存ストロークをキャッシュ
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const lastRenderedStrokeCount = useRef(0);
    // requestAnimationFrameのスロットリング用
    const rafIdRef = useRef<number | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
    const [isHovered, setIsHovered] = useState(false);
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

    // オフスクリーンキャンバスの初期化とリサイズ
    useEffect(() => {
      if (canvasSize.width > 0 && canvasSize.height > 0) {
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement("canvas");
        }
        offscreenCanvasRef.current.width = canvasSize.width;
        offscreenCanvasRef.current.height = canvasSize.height;
        // リサイズ時はキャッシュをクリアして再描画
        lastRenderedStrokeCount.current = 0;
      }
    }, [canvasSize]);

    const {
      strokes,
      isDrawing,
      startDrawing,
      continueDrawing,
      endDrawing,
      clearCanvas,
    } = useDraw({
      tool,
      color,
      width,
    });

    // Canvas rendering effect - 最適化版
    useEffect(() => {
      const canvas = canvasRef.current;
      const offscreenCanvas = offscreenCanvasRef.current;
      if (!canvas || !offscreenCanvas) return;

      const ctx = canvas.getContext("2d");
      const offscreenCtx = offscreenCanvas.getContext("2d");
      if (!ctx || !offscreenCtx) return;

      // ストロークが空の場合は両方のキャンバスをクリア
      if (strokes.length === 0) {
        offscreenCtx.clearRect(
          0,
          0,
          offscreenCanvas.width,
          offscreenCanvas.height
        );
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        lastRenderedStrokeCount.current = 0;
        return;
      }

      // Undo処理：ストローク数が減った場合は全体を再描画
      if (strokes.length < lastRenderedStrokeCount.current) {
        offscreenCtx.clearRect(
          0,
          0,
          offscreenCanvas.width,
          offscreenCanvas.height
        );

        // 全ストロークを再描画
        strokes.forEach((stroke: Stroke) => {
          if (!stroke || !stroke.points || stroke.points.length < 1) return;

          offscreenCtx.beginPath();
          offscreenCtx.strokeStyle = stroke.color;
          offscreenCtx.lineWidth = stroke.width;
          offscreenCtx.lineCap = "round";
          offscreenCtx.lineJoin = "round";

          if (stroke.tool === "eraser") {
            offscreenCtx.globalCompositeOperation = "destination-out";
          } else if (stroke.tool === "pen") {
            offscreenCtx.globalCompositeOperation = "source-over";
          } else {
            assertNever(stroke.tool);
          }

          offscreenCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            offscreenCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          offscreenCtx.stroke();

          // globalCompositeOperationをリセット
          offscreenCtx.globalCompositeOperation = "source-over";
        });

        lastRenderedStrokeCount.current = strokes.length;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(offscreenCanvas, 0, 0);
        return;
      }

      // 描画中のストローク（最後のストローク）と完成したストロークを分けて処理
      const completedStrokesCount = isDrawing
        ? strokes.length - 1
        : strokes.length;
      const newCompletedStrokes = strokes.slice(
        lastRenderedStrokeCount.current,
        completedStrokesCount
      );

      // 新しく完成したストロークをオフスクリーンキャンバスに描画
      if (newCompletedStrokes.length > 0) {
        newCompletedStrokes.forEach((stroke: Stroke) => {
          // 防御的チェック: strokeとpointsが存在することを確認
          if (!stroke || !stroke.points || stroke.points.length < 1) return;

          offscreenCtx.beginPath();
          offscreenCtx.strokeStyle = stroke.color;
          offscreenCtx.lineWidth = stroke.width;
          offscreenCtx.lineCap = "round";
          offscreenCtx.lineJoin = "round";

          if (stroke.tool === "eraser") {
            offscreenCtx.globalCompositeOperation = "destination-out";
          } else {
            offscreenCtx.globalCompositeOperation = "source-over";
          }

          offscreenCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            offscreenCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          offscreenCtx.stroke();

          // globalCompositeOperationをリセット
          // TODO: これを毎回リセットする必要があるか検討、現状はないとcanvas全体が透明になる
          offscreenCtx.globalCompositeOperation = "source-over";
        });

        // 描画済みのストローク数を更新
        lastRenderedStrokeCount.current = completedStrokesCount;
      }

      // メインキャンバスをクリアしてオフスクリーンキャンバスをコピー
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreenCanvas, 0, 0);

      // 描画中のストロークがあれば、メインキャンバスに描画
      if (isDrawing && strokes.length > 0) {
        const currentStroke = strokes[strokes.length - 1];
        const points = currentStroke.points;

        if (points.length > 1) {
          ctx.strokeStyle = currentStroke.color;
          ctx.lineWidth = currentStroke.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          if (currentStroke.tool === "eraser") {
            ctx.globalCompositeOperation = "destination-out";
          } else {
            ctx.globalCompositeOperation = "source-over";
          }

          // 描画中のストロークを全体描画（オフスクリーンキャンバスの上に重ねる）
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();

          // globalCompositeOperationをリセット
          ctx.globalCompositeOperation = "source-over";
        }
      }
    }, [strokes, isDrawing]);

    function handlePointerDown(e: React.PointerEvent) {
      if (disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      startDrawing({ x, y });
    }

    function handlePointerMove(e: React.PointerEvent) {
      if (disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Update cursor position for custom cursor
      setCursorPosition({ x, y });

      // Continue drawing if currently drawing - requestAnimationFrameでスロットリング
      if (isDrawing) {
        // 前のフレームをキャンセル
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }

        // 次のフレームで描画
        rafIdRef.current = requestAnimationFrame(() => {
          continueDrawing({ x, y });
          rafIdRef.current = null;
        });
      }
    }

    function handlePointerUp() {
      if (disabled) return;
      // クリーンアップ
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      endDrawing();
    }

    function handlePointerEnter() {
      setIsHovered(true);
    }

    function handlePointerLeave() {
      setIsHovered(false);
      setCursorPosition(null);
      // ポインターがcanvas外に出たら描画終了
      if (isDrawing) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        endDrawing();
      }
    }

    useImperativeHandle(ref, () => ({
      clear: () => {
        clearCanvas();
      },
    }));

    return (
      <div className="flex flex-col h-full w-full">
        <div ref={containerRef} className="relative w-full h-full">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="border border-gray-300 bg-white cursor-none w-full h-full block"
            style={{ width: "100%", height: "100%" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
          />
          {/* Custom Cursor */}
          {isHovered && cursorPosition && (
            <div
              className="absolute pointer-events-none border-2 rounded-full"
              style={{
                left: cursorPosition.x - width / 2,
                top: cursorPosition.y - width / 2,
                width: width,
                height: width,
                borderColor: tool === "eraser" ? "#ff0000" : color,
                backgroundColor:
                  tool === "eraser" ? "#ff00001a" : "transparent",
              }}
            />
          )}
        </div>
      </div>
    );
  }
);
