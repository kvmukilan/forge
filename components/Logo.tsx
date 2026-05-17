export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-sm bg-primary flex items-center justify-center flex-shrink-0">
        <span className="text-primary-foreground text-xs font-black">F</span>
      </div>
      <span className="font-black text-sm tracking-widest uppercase text-foreground">Forge</span>
    </div>
  )
}
