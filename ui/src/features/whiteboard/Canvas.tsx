import React, {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useDraw } from "./hooks/useDraw";
import type { Point, Stroke, Tool } from "./types/whiteboard";
import { assertNever } from "../../utils/types";

type CanvasProps = {
  tool: Tool;
  color: string;
  width: number;
  onClear?: () => void;
  onUndo?: () => void;
  isReadOnly?: boolean;
  isDimmed?: boolean;
  onStrokeComplete?: (stroke: Stroke) => void;
};

export type CanvasHandle = {
  clear: () => void;
};

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  (
    {
      tool,
      color,
      width,
      isReadOnly = false,
      isDimmed = false,
      onStrokeComplete,
    },
    ref
  ) => {
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
      if (isReadOnly) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      startDrawing({ x, y });
      // capture the pointer so we keep receiving pointer events even if the pointer
      // moves outside the canvas element
      try {
        (canvas as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
      } catch (err) {
        // ignore if unsupported
      }
    }

    function handlePointerMove(e: React.PointerEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Update cursor position for custom cursor
      setCursorPosition({ x, y });

      // Continue drawing if currently drawing - requestAnimationFrameでスロットリング
      if (isDrawing && !isReadOnly) {
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

    function handlePointerUp(e: React.PointerEvent) {
      if (isReadOnly) return;

      // クリーンアップ
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      const finished = endDrawing();
      // release pointer capture if present
      try {
        const canvas = canvasRef.current;
        if (
          canvas &&
          e?.pointerId &&
          (canvas as HTMLCanvasElement).releasePointerCapture
        ) {
          (canvas as HTMLCanvasElement).releasePointerCapture(e.pointerId);
        }
      } catch (err) {
        // ignore
      }
      if (finished && typeof onStrokeComplete === "function") {
        try {
          onStrokeComplete(finished as Stroke);
        } catch (err) {
          // ignore
        }
      }
    }

    function handlePointerEnter() {
      setIsHovered(true);
    }

    function handlePointerLeave(e: React.PointerEvent) {
      setIsHovered(false);
      setCursorPosition(null);
      // ポインターがcanvas外に出たら描画終了し、終了ストロークを親に通知
      if (isDrawing) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        const finished = endDrawing();
        if (finished && typeof onStrokeComplete === "function") {
          try {
            onStrokeComplete(finished as Stroke);
          } catch (err) {
            // ignore
          }
        }
        // release pointer capture if present
        try {
          const canvas = canvasRef.current;
          if (
            canvas &&
            e?.pointerId &&
            (canvas as HTMLCanvasElement).releasePointerCapture
          ) {
            (canvas as HTMLCanvasElement).releasePointerCapture(e.pointerId);
          }
        } catch (err) {
          // ignore
        }
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
            className={`border border-gray-300 bg-white w-full h-full block ${
              isReadOnly ? "cursor-default" : "cursor-none"
            }`}
            style={{ width: "100%", height: "100%" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
          />
          {/* Custom Cursor */}
          {isHovered && cursorPosition && !isReadOnly && (
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
          {/* Dimmed Overlay */}
          {isDimmed && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
            />
          )}
        </div>
      </div>
    );
  }
);

Canvas.displayName = "Canvas";
