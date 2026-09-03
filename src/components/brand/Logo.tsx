export const BRAND_NAVY = '#02234e'
export const BRAND_GREEN = '#6cbe2c'

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/brand/carbon-logic-mark.png"
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ height: size, width: 'auto' }}
    />
  )
}

export function LogoLockup({ width = 180, className }: { width?: number; className?: string }) {
  return (
    <img
      src="/brand/carbon-logic-lockup.png"
      alt="Carbon Logic"
      width={width}
      className={className}
      style={{ width, height: 'auto' }}
    />
  )
}
