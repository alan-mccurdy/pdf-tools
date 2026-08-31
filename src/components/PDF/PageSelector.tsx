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
          className={`w-12 h-12 rounded-lg border text-sm font-medium transition
            ${selected.includes(p.index)
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}
        >
          {p.index + 1}
        </button>
      ))}
    </div>
  )
}
