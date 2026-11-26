"use client";

// The interactive parts of the component gallery (page.tsx).
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-fields";
import { Modal } from "@/components/ui/modal";
import { PillFilters } from "@/components/ui/pill-filters";
import { useToast } from "@/components/ui/toast";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "concert", label: "Concert" },
  { value: "jam", label: "Jam" },
  { value: "workshop", label: "Workshop" },
  { value: "society", label: "Society" },
] as const;

export function PillFiltersDemo() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("all");
  return (
    <div>
      <PillFilters
        label="Event category"
        options={CATEGORIES}
        value={category}
        onChange={setCategory}
      />
      <p className="mt-2 text-small text-muted">Showing: {category}</p>
    </div>
  );
}

export function ModalDemo() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      <Button variant="dark" onClick={() => setOpen(true)}>
        Open a modal
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Post a listing">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setOpen(false);
            toast("Submitted! A moderator will review it.");
          }}
        >
          <TextField label="Title" name="title" required data-autofocus />
          <TextField label="Photo (optional)" name="photo" type="file" />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="dark">
              Submit for review
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function ToastDemo() {
  const toast = useToast();
  return <Button onClick={() => toast("Preview link copied.")}>Show a toast</Button>;
}
