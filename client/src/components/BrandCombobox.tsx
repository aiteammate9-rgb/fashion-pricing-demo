/**
 * BrandCombobox – Searchable brand dropdown using shadcn Command + Popover
 * Supports 187+ brands with search filtering
 */
import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { BRANDS } from "@/lib/pricing-engine";

interface BrandComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Group brands by category for better organization
const BRAND_GROUPS = [
  {
    label: "แบรนด์ไทย",
    brands: BRANDS.filter((b) =>
      [
        "Jaspal", "CPS", "Greyhound", "Sretsis", "Kloset", "Gentlewoman",
        "Carnival", "Pomelo", "Lyn", "Playhound", "Tango", "Sabina",
        "MC Jeans", "Body Glove", "Guy Laroche", "Pierre Cardin", "Dapper",
        "Patinya", "Tube Gallery", "Vatanika", "Asava", "Disaya", "Milin",
        "Flynow", "Theatre", "Senada", "Poem", "ESP", "Hooks", "Anya",
        "Naraya", "AIIZ", "Tawn C.", "Issue", "CC Double O",
      ].includes(b.value)
    ),
  },
  {
    label: "K-Fashion",
    brands: BRANDS.filter((b) =>
      [
        "Stylenanda", "Chuu", "Ader Error", "Gentle Monster", "Mardi Mercredi",
        "Nerdy", "Kirsh", "Covernat", "Thisisneverthat", "Andersson Bell",
        "Low Classic", "Wooyoungmi", "SPAO", "8 Seconds", "Emis", "ADLV",
        "Oioi", "Musinsa Standard", "Romantic Crown", "Sculptor", "Mahagrid",
        "Instantfunk", "Lucky Chouette", "Pushbutton", "Hyein Seo", "Kimhekim",
        "Dunst", "Nohant", "Kangol Korea", "Rolarola",
      ].includes(b.value)
    ),
  },
  {
    label: "Fast Fashion",
    brands: BRANDS.filter((b) =>
      [
        "Uniqlo", "H&M", "Zara", "Mango", "GAP", "Cotton On", "Topshop",
        "Pull&Bear", "Bershka",
      ].includes(b.value)
    ),
  },
  {
    label: "Sports & Outdoor",
    brands: BRANDS.filter((b) =>
      [
        "Nike", "Adidas", "New Balance", "Converse", "Vans", "Puma",
        "The North Face", "Champion", "Under Armour", "Mizuno", "ASICS",
        "Saucony", "Hoka", "On Running", "Salomon", "Lululemon", "Gymshark",
        "Alo Yoga", "Vuori", "Rapha", "Descente", "Goldwin", "Oakley",
        "Yonex", "Mammut", "Marmot", "Osprey", "Snow Peak", "And Wander",
        "Montbell", "Haglofs", "Peak Performance", "Brooks", "Sweaty Betty",
        "Outdoor Voices",
      ].includes(b.value)
    ),
  },
  {
    label: "Streetwear",
    brands: BRANDS.filter((b) =>
      [
        "Supreme", "Stussy", "Off-White", "BAPE", "Palace", "Essentials",
        "Comme des Garcons",
      ].includes(b.value)
    ),
  },
  {
    label: "Mid-Premium",
    brands: BRANDS.filter((b) =>
      [
        "Levi's", "Tommy Hilfiger", "Calvin Klein", "Lacoste", "Fred Perry",
        "Charles & Keith", "Carhartt WIP", "Dr. Martens",
      ].includes(b.value)
    ),
  },
  {
    label: "Vintage / Thrift",
    brands: BRANDS.filter((b) =>
      [
        "Wrangler", "Lee", "Pendleton", "LL Bean", "Woolrich", "Filson",
        "Schott", "Barbour", "Russell Athletic", "Mitchell & Ness", "Starter",
        "Nautica", "Fiorucci", "Coogi", "Carlo Colucci", "Iceberg",
        "Helmut Lang", "Raf Simons", "Hysteric Glamour", "Evisu", "XLarge",
        "Fubu", "Karl Kani", "Harley Davidson",
      ].includes(b.value)
    ),
  },
  {
    label: "Premium / Luxury",
    brands: BRANDS.filter((b) =>
      [
        "Coach", "Michael Kors", "Kate Spade", "Ralph Lauren", "Marc Jacobs",
        "Longchamp", "Gucci", "Louis Vuitton", "Burberry", "Prada",
        "Balenciaga",
      ].includes(b.value)
    ),
  },
];

// Collect all grouped brand values to find uncategorized ones
const groupedBrandValues = new Set(
  BRAND_GROUPS.flatMap((g) => g.brands.map((b) => b.value))
);
groupedBrandValues.add("No Brand");

// Add uncategorized brands as "Other" group
const uncategorizedBrands = BRANDS.filter(
  (b) => !groupedBrandValues.has(b.value)
);
if (uncategorizedBrands.length > 0) {
  BRAND_GROUPS.push({
    label: "แบรนด์อื่นๆ",
    brands: uncategorizedBrands,
  });
}

export default function BrandCombobox({
  value,
  onValueChange,
  placeholder = "ค้นหาแบรนด์...",
  className = "",
}: BrandComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Find current label
  const selectedLabel = useMemo(() => {
    if (!value) return placeholder;
    const found = BRANDS.find(
      (b) => b.value.toLowerCase() === value.toLowerCase()
    );
    return found?.label || value;
  }, [value, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full h-10 justify-between bg-white border-warm-200 text-sm font-medium hover:bg-warm-50 ${className}`}
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {selectedLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder={placeholder}
              value={search}
              onValueChange={setSearch}
              className="border-0 focus:ring-0"
            />
          </div>
          <CommandList className="max-h-[300px]">
            <CommandEmpty>ไม่พบแบรนด์ "{search}"</CommandEmpty>
            {/* No Brand option always visible */}
            {(!search || "ไม่มีแบรนด์".includes(search.toLowerCase()) || "no brand".includes(search.toLowerCase())) && (
              <CommandItem
                value="No Brand"
                onSelect={() => {
                  onValueChange("No Brand");
                  setOpen(false);
                  setSearch("");
                }}
                className="cursor-pointer"
              >
                <Check
                  className={`mr-2 h-4 w-4 ${value === "No Brand" ? "opacity-100" : "opacity-0"}`}
                />
                ไม่มีแบรนด์
              </CommandItem>
            )}
            {BRAND_GROUPS.map((group) => {
              const filtered = search
                ? group.brands.filter(
                    (b) =>
                      b.label.toLowerCase().includes(search.toLowerCase()) ||
                      b.value.toLowerCase().includes(search.toLowerCase())
                  )
                : group.brands;

              if (filtered.length === 0) return null;

              return (
                <CommandGroup key={group.label} heading={group.label}>
                  {filtered.map((brand) => (
                    <CommandItem
                      key={brand.value}
                      value={brand.value}
                      onSelect={() => {
                        onValueChange(brand.value);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          value.toLowerCase() === brand.value.toLowerCase()
                            ? "opacity-100"
                            : "opacity-0"
                        }`}
                      />
                      {brand.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
