"use client";

import { useState } from "react";
import { Combobox } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import mirListRaw from "@/data/mir_list.json";

type Mirna = {
  key: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const mirList: Mirna[] = mirListRaw.map((mir) => ({
  key: mir.key,
  label: mir.label,
}));

export default function CustomCombobox({ value, onChange }: Props) {
  const [query, setQuery] = useState("");

  const filtered =
    query === ""
      ? mirList
      : mirList.filter((item) =>
          item.label.toLowerCase().includes(query.toLowerCase())
        );

  return (
    <div className="relative w-full max-w-sm">
      <Combobox value={value} onChange={onChange}>
        <div className="relative">
          <div className="relative w-full cursor-default overflow-hidden rounded border border-gray-300 bg-white text-left shadow-md focus:outline-none sm:text-sm">
            <Combobox.Input
              className="w-full border-none py-2 pl-10 text-lg leading-5 text-gray-900 focus:ring-0"
              displayValue={(key: string) =>
                mirList.find((m) => m.key === key)?.label || key
              }
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a miRNA"
            />
            {/* חץ בצד שמאל */}
            <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {filtered.length === 0 ? (
              <div className="cursor-default select-none px-4 py-2 text-gray-700">
                No options found
              </div>
            ) : (
              filtered.map((item) => (
                <Combobox.Option
                  key={item.key}
                  value={item.key}
                  className={({ active }) =>
                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                      active ? "bg-blue-600 text-white" : "text-gray-900"
                    }`
                  }
                >
                  {item.label}
                </Combobox.Option>
              ))
            )}
          </Combobox.Options>
        </div>
      </Combobox>
    </div>
  );
}
