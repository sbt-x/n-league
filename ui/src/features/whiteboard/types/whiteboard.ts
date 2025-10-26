export type Tool = "pen" | "eraser";

export type Point = { x: number; y: number }; // 座標
export type Color = string; // HEXカラーコードや色名
export type Width = number; // ペン幅（px）

export interface Stroke {
  tool: Tool;
  color: Color;
  width: Width;
  points: Point[];
  /** optional metadata about the source canvas that produced this stroke
   *  used for scaling/positioning when rendering on a different-sized canvas
   */
  metadata?: {
    canvasWidth: number;
    canvasHeight: number;
  } | null;
}
