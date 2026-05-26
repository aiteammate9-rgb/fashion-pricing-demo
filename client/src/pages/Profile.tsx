/**
 * Profile Page — โปรไฟล์สไตล์ (ค่าเริ่มต้นสำหรับแมตช์ชุด + try-on)
 * --------------------------------------------------------------------------
 * รวมข้อมูลส่วนตัวที่ระบบแมตช์ชุดใช้: วันเกิด (สีนำโชค), สีผิว/อันเดอร์โทน,
 * ส่วนสูง/น้ำหนัก, สไตล์ที่ชอบ และรูปหน้า (ใช้เป็น reference ตอนเจน try-on).
 * บันทึกครั้งเดียว ใช้เป็นค่าเริ่มต้นทุกครั้งที่แมตช์ชุด.
 */
import { useState, useRef, type ChangeEvent } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogIn, Save, Camera, Sparkles, UserCircle, Home } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const SKIN_TONES: Array<{ value: string; label: string }> = [
  { value: "fair", label: "ขาวมาก" },
  { value: "light", label: "ขาว" },
  { value: "medium", label: "ปานกลาง" },
  { value: "tan", label: "ผิวสองสี" },
  { value: "deep", label: "เข้ม" },
];
const UNDERTONES: Array<{ value: string; label: string }> = [
  { value: "cool", label: "โทนเย็น (Cool)" },
  { value: "neutral", label: "โทนกลาง (Neutral)" },
  { value: "warm", label: "โทนอุ่น (Warm)" },
];
const STYLE_OPTIONS = [
  "มินิมอล",
  "เกาหลี",
  "วินเทจ",
  "สตรีท",
  "หวานละมุน",
  "เท่ / ทอมบอย",
  "ลำลอง",
  "ทางการ",
  "โบฮีเมียน",
  "ลักชัวรี",
  "สปอร์ต",
  "คลาสสิก",
  "ออฟฟิศ",
  "อินดี้ / อาร์ต",
];

function fileToBase64(file: File): Promise<{ b64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const m = /^data:([^;]+);base64,(.+)$/.exec(s);
      if (m) resolve({ mime: m[1], b64: m[2] });
      else reject(new Error("invalid image"));
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const profile = trpc.profile.me.useQuery(undefined, { enabled: !!user });

  const [birthDate, setBirthDate] = useState("");
  const [skinTone, setSkinTone] = useState("");
  const [undertone, setUndertone] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ b64: string; mime: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Prefill once from saved profile.
  if (profile.data && !loaded) {
    setBirthDate(profile.data.birthDate ?? "");
    setSkinTone(profile.data.skinTone ?? "");
    setUndertone(profile.data.undertone ?? "");
    setStyles(
      profile.data.preferredStyles
        ? profile.data.preferredStyles.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    );
    setLoaded(true);
  }

  const upsert = trpc.profile.upsert.useMutation({
    onSuccess: () => {
      toast.success("บันทึกโปรไฟล์แล้ว — ใช้เป็นค่าเริ่มต้นในการแมตช์ชุด");
      setPhoto(null);
      profile.refetch();
    },
    onError: (e) => toast.error(`บันทึกไม่สำเร็จ: ${e.message}`),
  });

  const onPickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const res = await fileToBase64(f);
      setPhoto(res);
      setPhotoPreview(URL.createObjectURL(f));
    } catch {
      toast.error("อ่านรูปไม่สำเร็จ");
    }
  };

  const toggleStyle = (s: string) =>
    setStyles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const onSave = () => {
    upsert.mutate({
      birthDate: birthDate || null,
      skinTone: (skinTone || null) as any,
      undertone: (undertone || null) as any,
      preferredStyles: styles.length ? styles.join(", ") : null,
      ...(photo ? { profilePhotoBase64: photo.b64, profilePhotoMimeType: photo.mime } : {}),
    });
  };

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
        <p className="text-muted-foreground">เข้าสู่ระบบเพื่อตั้งค่าโปรไฟล์</p>
        <a href={getLoginUrl()}>
          <Button>
            <LogIn className="w-4 h-4 mr-2" /> เข้าสู่ระบบ
          </Button>
        </a>
      </div>
    );
  }

  const currentPhoto = photoPreview || profile.data?.profilePhotoUrl || null;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> หน้าหลัก
            </Button>
          </Link>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-teal-600" /> โปรไฟล์สไตล์
          </h1>
          <a href="https://sheowa.com" aria-label="หน้าร้าน">
            <Button variant="ghost" size="sm">
              <Home className="w-4 h-4" />
            </Button>
          </a>
        </div>

        <Card className="mb-5">
          <CardContent className="p-5 space-y-5">
            {/* Face photo */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-muted flex items-center justify-center border border-border shrink-0">
                {currentPhoto ? (
                  <img src={currentPhoto} alt="face" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-7 h-7 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">รูปหน้าของคุณ</p>
                <p className="text-xs text-muted-foreground mb-2">
                  ใช้เป็นต้นแบบใบหน้าตอน AI เจนรูปลุค (try-on) ให้รู้สึกเป็นตัวเอง
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickPhoto}
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-1.5" /> เลือกรูปหน้า
                </Button>
              </div>
            </div>

            {/* Birthdate */}
            <div className="space-y-1.5">
              <Label className="text-xs">วันเดือนปีเกิด (สำหรับสีนำโชค)</Label>
              <Input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            {/* Skin tone / undertone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">สีผิว</Label>
                <select
                  className="w-full border border-input rounded-md px-2 py-2 text-sm bg-card"
                  value={skinTone}
                  onChange={(e) => setSkinTone(e.target.value)}
                >
                  <option value="">— เลือก —</option>
                  {SKIN_TONES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">อันเดอร์โทน</Label>
                <select
                  className="w-full border border-input rounded-md px-2 py-2 text-sm bg-card"
                  value={undertone}
                  onChange={(e) => setUndertone(e.target.value)}
                >
                  <option value="">— เลือก —</option>
                  {UNDERTONES.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preferred styles — multi-select chips */}
            <div className="space-y-1.5">
              <Label className="text-xs">สไตล์ที่ชอบ (เลือกได้หลายอัน)</Label>
              <div className="flex flex-wrap gap-2">
                {STYLE_OPTIONS.map((s) => {
                  const on = styles.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStyle(s)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        on
                          ? "bg-teal-600 border-teal-600 text-white"
                          : "bg-card border-input text-foreground hover:border-teal-300"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              ไม่ต้องกรอกรูปร่าง/ส่วนสูง — AI จะประเมินสัดส่วนและเจนลุคให้เองจากรูปหน้าและสไตล์ที่เลือก
            </p>

            <Button
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={upsert.isPending}
              onClick={onSave}
            >
              <Save className="w-4 h-4 mr-2" />
              {upsert.isPending ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          ข้อมูลนี้จะถูกใช้อัตโนมัติทุกครั้งที่แมตช์ชุด — ไม่ต้องกรอกซ้ำ
        </p>
      </div>
    </div>
  );
}
