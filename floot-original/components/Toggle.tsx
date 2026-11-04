"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import styles from "./Toggle.module.css"

export const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    {
      variant?: "default" | "outline";
      size?: "md" | "sm" | "lg";
      /** "pill" makes the toggle fully rounded. */
      shape?: "default" | "pill";
    }
>(({ className, variant = "default", size = "md", shape = "default", ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={`${styles.toggle} ${styles["toggle-variant-" + variant]} ${styles["toggle-size-" + size]} ${shape === "pill" ? styles["toggle-shape-pill"] : ""} ${className ?? ""}`}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName
