"use client";

import { useFormStatus } from "react-dom";

export function PendingSubmitButton({
  children,
  className,
  pendingLabel,
  disabled = false
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-disabled={pending || disabled}
      className={className}
      disabled={pending || disabled}
      type="submit"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
