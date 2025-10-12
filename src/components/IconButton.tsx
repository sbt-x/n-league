import React from "react";

interface ButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children: React.ReactNode;
  onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const IconButton: React.FC<ButtonProps> = ({
  onClick,
  className = "",
  children,
  onMouseDown,
}) => (
  <button
    onClick={onClick}
    onMouseDown={onMouseDown}
    className={`flex items-center justify-center rounded aspect-square ${className}`}
  >
    {children}
  </button>
);
