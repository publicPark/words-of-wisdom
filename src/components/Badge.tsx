interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: "public" | "guest" | "fresh" | "learning" | "mastered";
}

const variantStyles = {
  public: "badge-public",
  guest: "badge-guest",
  fresh: "badge-fresh",
  learning: "badge-learning",
  mastered: "badge-mastered",
};

export function Badge({
  children,
  variant = "guest",
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span className={`badge ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
