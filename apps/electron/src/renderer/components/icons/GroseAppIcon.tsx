import groseLogo from "@/assets/grose_logo_c.svg"

interface GroseAppIconProps {
  className?: string
  size?: number
}

/**
 * GroseAppIcon - Displays the Grose logo (colorful "C" icon)
 */
export function GroseAppIcon({ className, size = 64 }: GroseAppIconProps) {
  return (
    <img
      src={groseLogo}
      alt="Grose"
      width={size}
      height={size}
      className={className}
    />
  )
}
