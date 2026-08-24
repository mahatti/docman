import type { ChatMessage, DocItem, Source } from "./types";

export const SAMPLE_DOCS: DocItem[] = [
  {
    id: "1",
    name: "Laporan_Keuangan_Q3_2025.pdf",
    size: 4_820_000,
    type: "pdf",
    uploadedAt: new Date("2025-08-10"),
    pages: 48,
    procedures: 12,
    status: "ready",
    tags: ["keuangan", "laporan", "Q3"],
  },
  {
    id: "2",
    name: "SOP_Pengadaan_Barang.docx",
    size: 1_230_000,
    type: "docx",
    uploadedAt: new Date("2025-08-08"),
    pages: 24,
    procedures: 8,
    status: "ready",
    tags: ["SOP", "pengadaan"],
  },
  {
    id: "3",
    name: "Panduan_Sistem_ERP.pdf",
    size: 9_450_000,
    type: "pdf",
    uploadedAt: new Date("2025-08-05"),
    pages: 112,
    procedures: 31,
    status: "ready",
    tags: ["ERP", "sistem", "panduan"],
  },
  {
    id: "4",
    name: "Kebijakan_SDM_2025.pdf",
    size: 2_100_000,
    type: "pdf",
    uploadedAt: new Date("2025-08-01"),
    pages: 36,
    procedures: 5,
    status: "ready",
    tags: ["SDM", "kebijakan"],
  },
];

export const SAMPLE_QA: ChatMessage[] = [
  {
    role: "user",
    content: "Apa saja prosedur pengadaan barang yang harus diikuti?",
    timestamp: new Date("2025-08-12T09:15:00"),
  },
  {
    role: "assistant",
    content:
      "Berdasarkan dokumen SOP Pengadaan Barang, terdapat 8 prosedur utama yang harus diikuti:\n\n1. **Identifikasi Kebutuhan** — Tim pemohon mengisi formulir PR (Purchase Request) dan mendapat persetujuan manajer.\n2. **Seleksi Vendor** — Minimal 3 penawaran harga dari vendor terdaftar.\n3. **Evaluasi Penawaran** — Komite pengadaan menilai harga, kualitas, dan track record.\n4. **Persetujuan Anggaran** — PO di atas Rp 50 juta memerlukan approval Direktur.\n5. **Pembuatan Purchase Order** — Tim pengadaan menerbitkan PO resmi.\n6. **Monitoring Pengiriman** — Tracking status hingga barang diterima.\n7. **Pemeriksaan Barang** — Quality check oleh tim penerima.\n8. **Pembayaran** — Dilakukan setelah BAST ditandatangani.",
    sources: [
      {
        docName: "SOP_Pengadaan_Barang.docx",
        page: 7,
        excerpt: "Prosedur pengadaan wajib mengikuti alur yang telah ditetapkan...",
      },
      {
        docName: "SOP_Pengadaan_Barang.docx",
        page: 12,
        excerpt: "Seleksi vendor dilakukan dengan membandingkan minimal tiga penawaran...",
      },
    ],
    timestamp: new Date("2025-08-12T09:15:12"),
  },
];

export const CANNED: Record<string, { answer: string; sources: Source[] }> = {
  default: {
    answer:
      "Berdasarkan analisis dokumen yang tersedia, berikut informasi relevan yang saya temukan.\n\nSilakan ajukan pertanyaan yang lebih spesifik untuk mendapatkan jawaban yang lebih akurat dari konten dokumen Anda. Saya dapat membantu menjawab pertanyaan tentang prosedur, kebijakan, data keuangan, atau topik lain yang terkandung dalam dokumen terupload.",
    sources: [],
  },
  keuangan: {
    answer:
      "Berdasarkan **Laporan Keuangan Q3 2025**, berikut ringkasan kondisi keuangan:\n\n- **Pendapatan bersih**: Rp 48,3 miliar (naik 12% dari Q2)\n- **Beban operasional**: Rp 31,7 miliar\n- **EBITDA**: Rp 16,6 miliar (margin 34,4%)\n- **Kas & setara kas**: Rp 23,1 miliar\n\nLaporan mencatat 12 prosedur akuntansi yang wajib dipatuhi, termasuk prosedur rekonsiliasi bulanan dan pelaporan ke OJK setiap kuartal.",
    sources: [
      { docName: "Laporan_Keuangan_Q3_2025.pdf", page: 5, excerpt: "Ringkasan kinerja keuangan kuartal ketiga tahun 2025..." },
      { docName: "Laporan_Keuangan_Q3_2025.pdf", page: 18, excerpt: "Prosedur rekonsiliasi dilakukan setiap akhir bulan..." },
    ],
  },
  sdm: {
    answer:
      "Berdasarkan **Kebijakan SDM 2025**, berikut ketentuan utama terkait sumber daya manusia:\n\n**Cuti:**\n- Cuti tahunan: 12 hari kerja\n- Cuti sakit: sesuai surat dokter, maks 3 bulan dengan gaji\n- Cuti melahirkan: 3 bulan untuk ibu, 2 hari untuk ayah\n\n**Evaluasi kinerja:**\n- Dilakukan setiap 6 bulan (Januari & Juli)\n- Menggunakan sistem KPI berbasis OKR\n\n**Rekrutmen:**\n- Setiap posisi baru wajib melalui 5 tahap seleksi",
    sources: [
      { docName: "Kebijakan_SDM_2025.pdf", page: 8, excerpt: "Ketentuan cuti bagi karyawan tetap mengikuti UU Ketenagakerjaan..." },
      { docName: "Kebijakan_SDM_2025.pdf", page: 22, excerpt: "Proses rekrutmen terdiri dari seleksi administrasi, psikotes..." },
    ],
  },
};

export function detectTopic(q: string): string {
  const lower = q.toLowerCase();
  if (lower.includes("keuangan") || lower.includes("pendapatan") || lower.includes("laporan") || lower.includes("anggaran"))
    return "keuangan";
  if (lower.includes("sdm") || lower.includes("cuti") || lower.includes("karyawan") || lower.includes("rekrut"))
    return "sdm";
  return "default";
}
