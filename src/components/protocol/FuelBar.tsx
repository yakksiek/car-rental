// others
import { cn } from "../../lib/utils";
import { fuelLabelPl } from "../../lib/protocol-labels";

// Eight tappable segments — the design's fuel gauge. Buttons, not a range input:
// an employee in the rain hits a 22px-tall target, not a slider thumb. Each
// segment carries `aria-label={`${i}/8`}` so the control is operable and readable
// without sight of the fill.
//
// Tapping the segment that is already the level empties the tank (`0/8`), which
// is the only way to reach zero from an eight-segment bar.

interface Props {
  value: number | undefined;
  onChange: (value: number) => void;
  invalid?: boolean;
}

const SEGMENTS = [1, 2, 3, 4, 5, 6, 7, 8];

export function FuelBar({ value, onChange, invalid }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-[11px] font-[650] tracking-[0.01em]">Poziom paliwa</span>
      <span className="text-foreground text-[27px] leading-none font-bold tracking-tight tabular-nums">
        {value === undefined ? "—" : fuelLabelPl(value)}
      </span>
      <div
        id="fuelEighths"
        role="group"
        aria-label="Poziom paliwa"
        aria-invalid={invalid ?? undefined}
        tabIndex={-1}
        className="mt-1 flex gap-[3px]"
      >
        {SEGMENTS.map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i}/8`}
            aria-pressed={value !== undefined && value >= i}
            onClick={() => {
              onChange(value === i ? 0 : i);
            }}
            className={cn(
              "h-[22px] flex-1 rounded-[4px] transition-colors",
              value !== undefined && value >= i ? "bg-foreground" : "bg-[var(--flota-hair-2)]",
              invalid && "ring-destructive ring-1",
            )}
          />
        ))}
      </div>
      <div className="text-muted-foreground flex justify-between font-mono text-[11px] font-bold">
        <span>E</span>
        <span>F</span>
      </div>
    </div>
  );
}
