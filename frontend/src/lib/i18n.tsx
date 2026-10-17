import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "zh" | "en" | "fil" | "id";
export const LANGS: { k: Lang; label: string }[] = [
  { k: "zh", label: "繁中" }, { k: "en", label: "EN" }, { k: "fil", label: "Filipino" }, { k: "id", label: "Indonesia" },
];

type Dict = Record<string, [zh: string, en: string, fil: string, id: string]>;
const D: Dict = {
  resident: ["住民", "Resident", "Residente", "Penghuni"],
  coordinator: ["管理端", "Coordinator", "Coordinator", "Koordinator"],
  simulate: ["模擬地震", "Simulate earthquake", "I-simulate ang lindol", "Simulasi gempa"],
  restart: ["重新點名", "Restart roll call", "Ulitin ang roll call", "Ulangi absensi"],
  endDrill: ["結束演練", "End drill", "Tapusin ang drill", "Akhiri latihan"],
  alert: ["花蓮地震規模5.8，雙北有感。請立即回報安全狀態。", "M5.8 earthquake detected in Hualien — shaking felt in Taipei / New Taipei. Check in now.", "M5.8 na lindol sa Hualien — ramdam sa Taipei / New Taipei. Mag-check in ngayon.", "Gempa M5.8 di Hualien — guncangan terasa di Taipei / New Taipei. Segera lapor."],
  receiving: ["接收回報中…", "Receiving check-ins…", "Tumatanggap ng check-in…", "Menerima laporan…"],
  hi: ["你好", "Hi", "Kumusta", "Halo"],
  notReported: ["尚未回報", "Not reported yet", "Hindi pa nag-uulat", "Belum melapor"],
  checkin: ["緊急回報", "Emergency check-in", "Emergency check-in", "Lapor darurat"],
  SAFE: ["安全／已撤離", "Safe / Evacuated", "Ligtas / Nakalabas", "Aman / Sudah evakuasi"],
  INSIDE: ["安全但仍在室內", "Safe, still inside", "Ligtas, nasa loob pa", "Aman, masih di dalam"],
  HELP: ["需要協助", "Need help", "Kailangan ng tulong", "Butuh bantuan"],
  UNKNOWN: ["未知", "Unknown", "Hindi alam", "Tidak diketahui"],
  sos: ["SOS 緊急求救", "SOS — Urgent help", "SOS — Agarang tulong", "SOS — Bantuan darurat"],
  sosSent: ["已通知管理員，列為最優先救援。", "SOS sent — you are at the top of the coordinator's priority list.", "Naipadala ang SOS — ikaw ang pinakaunang prayoridad.", "SOS terkirim — Anda prioritas utama koordinator."],
  roommate: ["室友", "Roommate", "Kasama sa kuwarto", "Teman sekamar"],
  peer: ["室友與我同在且安全", "My roommate is safe with me", "Ligtas ang kasama ko sa kuwarto", "Teman sekamar saya aman bersama saya"],
  report: ["通報狀況", "Report a problem", "Mag-ulat ng problema", "Laporkan masalah"],
  floor: ["樓層", "Floor", "Palapag", "Lantai"],
  area: ["房號／區域", "Room / area", "Kuwarto / lugar", "Kamar / area"],
  describe: ["描述狀況", "Describe what you see", "Ilarawan ang nakikita mo", "Jelaskan yang Anda lihat"],
  photo: ["拍照／上傳", "Photo", "Larawan", "Foto"],
  submit: ["送出通報", "Submit report", "Ipadala ang ulat", "Kirim laporan"],
  sent: ["已送出給管理員。", "Report sent to coordinators.", "Naipadala sa mga coordinator.", "Laporan terkirim ke koordinator."],
  routes: ["疏散路線", "Evacuation routes", "Mga ruta ng paglikas", "Jalur evakuasi"],
  numbers: ["緊急電話", "Emergency numbers", "Mga emergency number", "Nomor darurat"],
  shelters: ["鄰近避難收容處所", "Nearest shelters", "Pinakamalapit na evacuation center", "Tempat pengungsian terdekat"],
  maps: ["以 Google 地圖開啟", "Open in Google Maps", "Buksan sa Google Maps", "Buka di Google Maps"],
  capacity: ["容量", "Capacity", "Kapasidad", "Kapasitas"],
  locNote: ["位置僅在您回報時記錄，不會持續追蹤。", "Location is recorded only when you check in — never tracked continuously.", "Itinatala lang ang lokasyon kapag nag-check in ka — hindi tuloy-tuloy na sinusubaybayan.", "Lokasi hanya dicatat saat Anda melapor — tidak dilacak terus-menerus."],
  offline: ["離線模式：回報已暫存，恢復連線後自動同步", "Offline — check-ins and SOS are queued and will sync automatically", "Offline — naka-queue ang check-in at SOS, awtomatikong isi-sync", "Offline — laporan & SOS diantre dan akan disinkronkan otomatis"],
  queued: ["待同步", "queued", "naka-queue", "antre"],
  synced: ["已同步", "Synced", "Na-sync", "Tersinkron"],
  goOffline: ["模擬離線", "Go offline", "Mag-offline", "Mode offline"],
  goOnline: ["恢復連線", "Go online", "Mag-online", "Kembali online"],
  live: ["即時點名", "Live headcount", "Live na bilang", "Hitungan langsung"],
  reports: ["通報", "Reports", "Mga ulat", "Laporan"],
  roster: ["住民名冊", "Residents", "Mga residente", "Penghuni"],
  building: ["建築設定", "Building", "Gusali", "Gedung"],
  privacy: ["個資與保存", "Privacy & retention", "Privacy at retention", "Privasi & retensi"],
  handoff: ["救援交接", "Responder handoff", "Handoff sa responder", "Serah terima petugas"],
  total: ["登記人數", "Total registered", "Kabuuang rehistrado", "Total terdaftar"],
  safeShort: ["安全", "Safe", "Ligtas", "Aman"],
  insideShort: ["仍在室內", "Still inside", "Nasa loob pa", "Masih di dalam"],
  helpShort: ["需要協助", "Need assistance", "Kailangan ng tulong", "Butuh bantuan"],
  unacc: ["未回報", "Unaccounted", "Hindi pa matukoy", "Belum terdata"],
  matrix: ["樓層點名矩陣", "Floor accountability matrix", "Matrix ng bawat palapag", "Matriks per lantai"],
  priority: ["優先救援", "Priority rescue list", "Listahan ng prayoridad", "Daftar prioritas"],
  stairs: ["樓梯與路線", "Stairwells & routes", "Hagdanan at ruta", "Tangga & jalur"],
  noEmergency: ["尚無緊急事件。按上方「模擬地震」開始點名。", "No active emergency. Press Simulate earthquake above to start a roll call.", "Walang aktibong emergency. Pindutin ang I-simulate ang lindol.", "Tidak ada keadaan darurat. Tekan Simulasi gempa di atas."],
  role: ["存取角色", "Access role", "Tungkulin", "Peran akses"],
  denied: ["您的角色無權檢視此資料。", "Your role cannot view this data.", "Hindi ito makikita ng iyong tungkulin.", "Peran Anda tidak dapat melihat data ini."],
  areas: ["影響地區", "Areas", "Mga lugar", "Wilayah"],
  disasterType: ["災害類別", "Disaster type", "Uri ng sakuna", "Jenis bencana"],
  radius: ["範圍", "Radius", "Radius", "Radius"],
  all: ["全部", "All", "Lahat", "Semua"],
  noShelters: ["範圍內無符合的收容處所", "No matching shelters in range", "Walang tugmang evacuation center", "Tidak ada tempat pengungsian yang cocok"],
  vulnerableOk: ["適合弱者安置", "Wheelchair / vulnerable OK", "Angkop sa wheelchair", "Ramah kursi roda"],
  earthquake: ["地震", "Earthquake", "Lindol", "Gempa"],
  flood: ["水災", "Flood", "Baha", "Banjir"],
  landslide: ["土石流", "Landslide", "Pagguho", "Tanah longsor"],
  typhoon: ["颱風", "Typhoon", "Bagyo", "Topan"],
  tsunami: ["海嘯", "Tsunami", "Tsunami", "Tsunami"],
  fire: ["火災", "Fire", "Sunog", "Kebakaran"],
};
const IDX: Record<Lang, number> = { zh: 0, en: 1, fil: 2, id: 3 };

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof D) => string }>({
  lang: "zh", setLang: () => {}, t: (k) => D[k]![0]!,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangS] = useState<Lang>("zh");
  useEffect(() => {
    const s = localStorage.getItem("dormsafe-lang") as Lang | null;
    if (s && s in IDX) setLangS(s);
  }, []);
  const setLang = (l: Lang) => { setLangS(l); localStorage.setItem("dormsafe-lang", l); };
  const t = (k: keyof typeof D) => D[k]![IDX[lang]]!;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx);
export type TKey = keyof typeof D;
