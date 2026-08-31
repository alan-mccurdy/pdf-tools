interface PageSelectorProps {
  pages: { index: number }[]
  selected: number[]
  onSelect: (indices: number[]) => void
  mode?: 'multiple' | 'range'
}

export default function PageSelector({ pages, selected, onSelect, mode = 'multiple' }: PageSelectorProps) {
  const toggle = (idx: number) => {
    if (mode === 'multiple') {
      onSelect(
        selected.includes(idx)
          ? selected.filter(i => i !== idx)
          : [...selected, idx]
      )
    }
  }

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {pages.map(p => {
        const isSelected = selected.includes(p.index)
        return (
          <button
            key={p.index}
            onClick={() => toggle(p.index)}
            className={`w-12 h-12 rounded-xl border text-sm font-medium transition-all duration-200 ${
              isSelected
                ? 'bg-[var(--accent-soft)] border-[var(--accent-strong)] shadow-[0_0_12px_var(--accent-glow)]'
                : 'spatial-surface hover:border-white/[0.16]'
            }`}
            style={{ color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}
          >
            {p.index + 1}
          </button>
        )
      })}
    </div>
  )
}
