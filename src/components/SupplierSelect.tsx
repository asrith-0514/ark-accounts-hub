import { useEffect, useMemo, useState } from "react";
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
import { useData } from "@/lib/store";
import { SupplierForm } from "./SupplierForm";

const RECENT_KEY = "ark-recent-suppliers";
const RECENT_MAX = 5;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}
function pushRecent(id: string) {
  if (typeof window === "undefined") return;
  const list = [id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowAdd?: boolean;
}

export function SupplierSelect({
  value,
  onChange,
  placeholder = "Search Supplier...",
  disabled,
  className,
  allowAdd = true,
}: Props) {
  const { suppliers } = useData();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => setRecent(readRecent()), [open]);

  const active = useMemo(
    () => suppliers.filter((s) => !s.archived),
    [suppliers],
  );
  const sorted = useMemo(
    () => [...active].sort((a, b) => a.supplierName.localeCompare(b.supplierName)),
    [active],
  );
  const recentSuppliers = useMemo(
    () => recent.map((id) => active.find((s) => s.id === id)).filter(Boolean).slice(0, RECENT_MAX) as typeof active,
    [recent, active],
  );

  const selected = suppliers.find((s) => s.id === value);

  const pick = (id: string) => {
    onChange(id);
    pushRecent(id);
    setRecent(readRecent());
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
          >
            <span className="truncate">
              {selected ? `${selected.code} · ${selected.supplierName}` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
          <Command shouldFilter>
            <CommandInput placeholder="Search supplier..." value={query} onValueChange={setQuery} />
            <CommandList className="max-h-72">
              <CommandEmpty>
                <div className="p-2 text-sm text-muted-foreground">No supplier found.</div>
              </CommandEmpty>
              {recentSuppliers.length > 0 && !query && (
                <>
                  <CommandGroup heading="Recently used">
                    {recentSuppliers.map((s) => (
                      <CommandItem key={`r-${s.id}`} value={`recent ${s.supplierName}`} onSelect={() => pick(s.id)}>
                        <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                        <span className="text-xs font-mono text-muted-foreground mr-2">{s.code}</span>
                        <span className="truncate">{s.supplierName}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              <CommandGroup heading="All suppliers">
                {sorted.map((s) => (
                  <CommandItem key={s.id} value={`${s.code} ${s.supplierName}`} onSelect={() => pick(s.id)}>
                    <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                    <span className="text-xs font-mono text-muted-foreground mr-2">{s.code}</span>
                    <span className="truncate">{s.supplierName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {allowAdd && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setPendingName(query);
                        setOpen(false);
                        setFormOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {query ? `+ Add "${query}"` : "+ Add New Supplier"}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {allowAdd && (
        <SupplierForm
          open={formOpen}
          onOpenChange={setFormOpen}
          initialName={pendingName}
          onSaved={(s) => pick(s.id)}
        />
      )}
    </>
  );
}
