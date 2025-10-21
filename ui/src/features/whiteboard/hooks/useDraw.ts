import { useCallback, useRef, useState } from "react";
import type { Point } from "../types/whiteboard";
import type { Stroke, Tool } from "../types/whiteboard";

interface UseDrawOptions {
  tool: Tool;
  color: string;
  width: number;
}

export function useDraw({ tool, color, width }: UseDrawOptions) {
  // 描画されたストロークのリスト
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  // 描画中かどうかの状態
  const [isDrawing, setIsDrawing] = useState(false);
  // 現在描画中のストロークを保持するためのref
  const currentStroke = useRef<Stroke | null>(null);

  const startDrawing = useCallback(
    (point: Point) => {
      const newStroke: Stroke = {
        tool,
        color,
        width,
        points: [point],
      };
      currentStroke.current = newStroke;
      setStrokes((prev) => [...prev, newStroke]);
      setIsDrawing(true);
    },
    [tool, color, width]
  );

  // 描画中のストロークをcanvasに描画
  const continueDrawing = useCallback((point: Point) => {
    if (!currentStroke.current) return;

    // 現在のストロークにポイントを追加
    currentStroke.current.points.push(point);

    // レースコンディションを避けるため、ローカル参照を保持
    const strokeRef = currentStroke.current;

    // 最後のストロークのみを更新
    setStrokes((prev) => {
      if (prev.length === 0) return prev;

      // 最後の要素だけを新しいオブジェクトで置き換え
      const newStrokes = [...prev];
      newStrokes[newStrokes.length - 1] = {
        ...strokeRef,
        points: strokeRef.points,
      };
      return newStrokes;
    });
  }, []);

  // 描画終了 - 完了したストロークを返す
  const endDrawing = useCallback(() => {
    const finished = currentStroke.current;
    currentStroke.current = null;
    setIsDrawing(false);
    return finished ?? null;
  }, []);

  // キャンバスをクリア
  const clearCanvas = useCallback(() => {
    setStrokes([]);
    currentStroke.current = null;
    setIsDrawing(false);
  }, []);

  // Undo機能
  const undo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  return {
    strokes,
    isDrawing,
    startDrawing,
    continueDrawing,
    endDrawing,
    clearCanvas,
    undo,
  };
}
