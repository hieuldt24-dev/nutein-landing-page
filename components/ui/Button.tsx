import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        solid:
          "bg-gradient-to-br from-primary to-primary-deep text-white shadow-brand hover:-translate-y-0.5 hover:shadow-lg",
        "outline-pill":
          "bg-transparent text-ink border-[1.5px] border-[color:var(--color-border)] hover:border-primary hover:text-primary hover:bg-primary-soft/40 hover:-translate-y-0.5",
        ghost: "bg-transparent text-ink hover:bg-primary-soft/50",
      },
      size: {
        sm: "text-sm px-5 py-2.5",
        md: "text-base px-8 py-3.5",
        lg: "text-lg px-10 py-4.5",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "md",
    },
  }
);

type ButtonBaseProps = VariantProps<typeof buttonVariants> & {
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = ButtonBaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = ButtonBaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

type ButtonProps = ButtonAsButton | ButtonAsLink;

/** Button primitive dùng chung cho CTA — pill solid caramel, outline-pill, ghost. */
export function Button({ className, variant, size, children, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if ("href" in props && props.href) {
    const { href, ...rest } = props as ButtonAsLink;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
