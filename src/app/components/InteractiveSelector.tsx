'use client'

import { useState } from 'react'

type Props = {
  mirnas: string[]
  onSelect: (mir: string) => void
  selected: string
}

export default function InteractiveSelector({ mirnas, onSelect, selected }: Props) {
  const [query, setQuery] = useState('')

  const filtered = mirnas.filter((m) =>
    m.toLowerCase().startsWith(query.toLowerCase())
  )

  return (
    <div className="mb-4 w-full max-w-md">
      <input
        type="text"
        placeholder="Search miRNA"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded mb-2"
      />
      <ul className="max-h-48 overflow-auto border border-gray-200 rounded">
        {filtered.length === 0 && (
          <li className="p-2 text-gray-500">No options</li>
        )}
        {filtered.map((mir) => (
          <li
            key={mir}
            className={`p-2 cursor-pointer hover:bg-gray-100 ${
              selected === mir ? 'bg-gray-200 font-bold' : ''
            }`}
            onClick={() => {
              onSelect(mir)
              setQuery('')
            }}
          >
            {mir}
          </li>
        ))}
      </ul>
    </div>
  )
}
