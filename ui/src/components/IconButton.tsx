import React from "react";

interface ButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children: React.ReactNode;
  onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  border?: "rounded" | "square";
}

export const IconButton: React.FC<ButtonProps> = ({
  onClick,
  className = "",
  children,
  onMouseDown,
  border = "rounded",
}) => {
  const borderRadius = border === "rounded" ? "rounded" : "rounded-none";

  return (
    <button
      onClick={onClick}
      onMouseDown={onMouseDown}
      className={`flex items-center justify-center ${borderRadius} aspect-square ${className}`}
    >
      {children}
    </button>
  );
};
