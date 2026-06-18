import { Eye, EyeOff } from "lucide-react";

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

// Trailing eye toggle inside the light staff FormField row (flex child, not
// absolutely positioned).
export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-muted-foreground hover:text-foreground flex shrink-0 items-center transition-colors"
      aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}
