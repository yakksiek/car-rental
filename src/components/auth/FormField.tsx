import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "../../lib/utils";

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  hint?: ReactNode;
  icon: ReactNode;
  endContent?: ReactNode;
}

// Light "boxed" field for the staff sign-in (Strefa pracownika). One bordered
// row: leading icon, input, optional trailing control (e.g. the password eye).
// Matches the design's LoginField (staff-login.jsx).
export function FormField({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  hint,
  icon,
  endContent,
}: FormFieldProps) {
  return (
    <label className="block">
      <span className="mb-[7px] block text-[11.5px] font-[650] tracking-[0.2px] text-[var(--flota-ink-2)]">
        {label}
      </span>
      <div
        className={cn(
          "bg-background flex h-[50px] items-center gap-2.5 rounded-xl border px-3.5 transition-colors focus-within:ring-2",
          error ? "border-destructive/60 focus-within:ring-destructive/40" : "border-border focus-within:ring-ring/30",
        )}
      >
        <span className="text-muted-foreground flex shrink-0 items-center">{icon}</span>
        <input
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 border-none bg-transparent text-[14.5px] font-medium outline-none"
        />
        {endContent}
      </div>
      {error ? (
        <p className="text-destructive mt-1.5 flex items-center gap-1 text-xs">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : (
        hint
      )}
    </label>
  );
}
