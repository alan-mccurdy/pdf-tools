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
      {pages.map(p => (
        <button
          key={p.index}
          onClick={() => toggle(p.index)}
          className={`w-12 h-12 rounded-xl border text-sm font-medium transition-all duration-200
            ${selected.includes(p.index)
              ? 'bg-blue-500/20 border-blue-400/50 text-blue-300 shadow-[0_0_10px_rgba(96,165,250,0.15)]'
              : 'glass-card !rounded-xl text-gray-400 hover:text-white hover:border-white/20'}`}
        >
          {p.index + 1}
        </button>
      ))}
    </div>
  )
}
