import React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
};

const baseClass =
  "px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition";

export const Button: React.FC<ButtonProps> = ({
  className = "",
  children,
  ...props
}) => (
  <button className={`${baseClass} ${className}`} {...props}>
    {children}
  </button>
);

Button.displayName = "Button";
