"use client"

import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import toggleStyles from "./Toggle.module.css"
import styles from "./ToggleGroup.module.css"

// A segmented control: the items sit in a tinted track and the pressed one is
// raised as a card. `variant` is accepted for compatibility; the segmented
// look is the same for both.
//
// Meant for 2-5 short options in one row. The track is an inner element, not
// the root: a className on the group (say `display: flex; flex-wrap: wrap`
// for a filter bar) styles the outer box, which has the track as its only
// child, so it can never split the items onto a second row. When the row does
// not fit, the track scrolls sideways and a focused item scrolls into view.
type VariantProps = {
  variant?: "default" | "outline";
  size?: "sm" | "md" | "lg" | "icon" | "icon-sm" | "icon-md" | "icon-lg";
  /** "pill" makes the track and its items fully rounded. */
  shape?: "default" | "pill";
}

type ItemSize = "sm" | "md" | "lg"

const itemSize = (size: VariantProps["size"]): ItemSize =>
  size === "sm" || size === "icon-sm" ? "sm" : size === "lg" || size === "icon-lg" ? "lg" : "md"

const ToggleGroupContext = React.createContext<VariantProps>({
  size: "md",
  variant: "default",
  shape: "default",
})

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps
>(({ className, variant = "default", size = "md", shape = "default", children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={`${styles.toggleGroup} ${shape === "pill" ? styles.pill : ""} ${className ?? ""}`}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size, shape }}>
      <div className={styles.track}>{children}</div>
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
))

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps
>(({ className, children, variant: _variant, size, shape: _shape, onFocus, ...props }, ref) => {
  const { size: groupSize } = React.useContext(ToggleGroupContext)
  const s = itemSize(size ?? groupSize)

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={`${toggleStyles.toggle} ${toggleStyles["toggle-size-" + s]} ${styles.item} ${styles["item-size-" + s]} ${className ?? ""}`}
      onFocus={(e) => {
        // Keyboard focus can land on an item scrolled out of a narrow track.
        e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })
        onFocus?.(e)
      }}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
