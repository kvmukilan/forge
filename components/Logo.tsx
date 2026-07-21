export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
        <span className="text-primary-foreground text-xs font-black">F</span>
      </div>
      <span className="hidden text-sm font-extrabold tracking-[0.14em] text-foreground min-[430px]:inline">FORGE</span>
    </div>
  )
}
