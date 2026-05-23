/**
 * ImageUploader – Soft Utility Design
 * อัปโหลดรูปเสื้อผ้าไม่เกิน 3 รูป: ด้านหน้า, ด้านหลัง, ตำหนิ
 */
import { Camera, ImagePlus, X } from "lucide-react";
import { useCallback, useRef } from "react";

interface ImageSlot {
  label: string;
  sublabel: string;
  file: File | null;
  preview: string | null;
}

interface Props {
  slots: ImageSlot[];
  onUpdate: (index: number, file: File | null) => void;
}

export default function ImageUploader({ slots, onUpdate }: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFileChange = useCallback(
    (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      onUpdate(index, file);
      // Reset input so same file can be re-selected
      if (inputRefs.current[index]) {
        inputRefs.current[index]!.value = "";
      }
    },
    [onUpdate]
  );

  const handleRemove = useCallback(
    (index: number) => {
      onUpdate(index, null);
    },
    [onUpdate]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Camera className="w-4 h-4 text-teal-600" />
        <span className="text-sm font-semibold text-foreground">
          รูปสินค้า <span className="font-normal text-muted-foreground">(ไม่เกิน 3 รูป)</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {slots.map((slot, i) => (
          <div key={i} className="relative group">
            <input
              ref={(el) => { inputRefs.current[i] = el; }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(i, e)}
            />

            {slot.preview ? (
              <div
                className="relative aspect-square rounded-xl overflow-hidden border-2 border-teal-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <img
                  src={slot.preview}
                  alt={slot.label}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-50"
                >
                  <X className="w-3.5 h-3.5 text-red-500" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1.5">
                  <p className="text-[11px] font-medium text-white leading-tight">{slot.label}</p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRefs.current[i]?.click()}
                className="aspect-square w-full rounded-xl border-2 border-dashed border-warm-200 bg-warm-50 hover:border-teal-300 hover:bg-teal-50/30 transition-all duration-200 flex flex-col items-center justify-center gap-1.5 group/btn"
              >
                <div className="w-9 h-9 rounded-full bg-warm-100 group-hover/btn:bg-teal-100 flex items-center justify-center transition-colors duration-200">
                  <ImagePlus className="w-4 h-4 text-muted-foreground group-hover/btn:text-teal-600 transition-colors duration-200" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground leading-tight text-center px-1">
                  {slot.label}
                </span>
                <span className="text-[9px] text-muted-foreground/60 leading-tight">
                  {slot.sublabel}
                </span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
