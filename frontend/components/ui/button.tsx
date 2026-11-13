import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonStyles = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-55 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white shadow-[0_7px_18px_rgba(17,168,137,.18)] hover:bg-accent-strong",
        secondary: "border border-line bg-surface text-ink hover:bg-surface-soft",
        ghost: "text-muted hover:bg-surface-soft hover:text-ink",
        danger: "bg-danger-soft text-danger hover:brightness-[.98]",
        outline: "border border-line bg-transparent text-ink hover:bg-surface-soft",
        dark: "bg-[#18231f] text-white hover:bg-[#22332d] dark:bg-[#eaf2ee] dark:text-[#15201b]",
      },
      size: {
        default: "min-h-10 px-4 py-2.5",
        sm: "min-h-8 rounded-lg px-3 text-xs",
        lg: "min-h-12 rounded-[14px] px-5 text-[14px]",
        icon: "size-10 p-0",
        "icon-sm": "size-8 rounded-lg p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
