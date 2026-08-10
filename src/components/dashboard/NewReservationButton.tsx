// core
import * as React from "react";
import { Plus } from "lucide-react";

// components
import { ManualReservationModal } from "./ManualReservationModal";

// others
import type { Vehicle } from "../../types";

// The manual-reservation entry point (S-12): one ink pill that opens the modal
// directly. The mockup draws a multi-item quick-action menu (Nowy klient / Dodaj
// pojazd / Szybkie wydanie) — out of scope, so this is a single button (design
// contract D4). It lives in the reservations page's own <main>, deliberately NOT
// in the shell nav, which S-11 owns.

const COPY = { newReservation: "Nowa rezerwacja" } as const;

export default function NewReservationButton({ vehicles }: { vehicles: Vehicle[] }) {
  const [open, setOpen] = React.useState(false);

  // Nothing bookable, nothing to offer: with an empty active fleet the modal's
  // vehicle picker would have no options and every create would be refused.
  if (vehicles.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="bg-foreground inline-flex h-[38px] items-center gap-[7px] rounded-[10px] pr-3.5 pl-3 text-[13px] font-[650] text-white"
      >
        <Plus className="size-[15px]" />
        {COPY.newReservation}
      </button>

      {open && (
        <ManualReservationModal
          vehicles={vehicles}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
