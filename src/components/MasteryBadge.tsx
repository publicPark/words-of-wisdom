import Image from "next/image";
import { Badge } from "./Badge";

export function MasteryBadge({ level }: { level: 1 | 2 | 3 }) {
  const variant = level === 1 ? "fresh" : level === 2 ? "learning" : "mastered";
  const label = level === 1 ? "Fresh" : level === 2 ? "Growing" : "Mastered";
  const imageSrc = `/lev${level}.png`;

  return (
    <Badge
      variant={variant}
      aria-label={`Mastery: ${label}`}
      className="gap-1.5"
    >
      <Image
        src={imageSrc}
        alt=""
        width={16}
        height={16}
        className="object-contain"
      />
      {label}
    </Badge>
  );
}
