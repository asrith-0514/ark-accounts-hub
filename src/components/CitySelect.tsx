import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { citiesForState } from "@/lib/india-locations";

interface Props {
  state: string;
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CitySelect({
  state,
  value,
  onChange,
  placeholder = "Select city",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const cities = useMemo(() => {
    const base = citiesForState(state);
    const set = new Set(base);
    if (value && !set.has(value)) set.add(value);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [state, value]);

  const canAdd =
    query.trim().length > 0 &&
    !cities.some((c) => c.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || !state}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value || (state ? placeholder : "Select state first")}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[240px]" align="start">
        <Command shouldFilter>
          <CommandInput placeholder="Search city..." value={query} onValueChange={setQuery} />
          <CommandList className="max-h-60">
            <CommandEmpty>
              <div className="p-2 text-sm text-muted-foreground">No city found.</div>
            </CommandEmpty>
            <CommandGroup>
              {cities.map((c) => (
                <CommandItem
                  key={c}
                  value={c}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c ? "opacity-100" : "opacity-0")} />
                  {c}
                </CommandItem>
              ))}
            </CommandGroup>
            {canAdd && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onChange(query.trim());
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add custom city "{query.trim()}"
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
