import React from "react";

interface ButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children: React.ReactNode;
  onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  border?: "rounded" | "square";
  disabled?: boolean;
}

export const IconButton: React.FC<ButtonProps> = ({
  onClick,
  className = "",
  children,
  onMouseDown,
  border = "rounded",
  disabled = false,
}) => {
  const borderRadius = border === "rounded" ? "rounded" : "rounded-none";

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseDown={onMouseDown}
      className={`flex items-center justify-center ${borderRadius} aspect-square ${className} ${disabled ? "opacity-60 cursor-not-allowed" : ""} transition-colors duration-200 ease-in-out`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

IconButton.displayName = "IconButton";
