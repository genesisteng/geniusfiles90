import { createFileRoute } from "@tanstack/react-router";
import {
  GfPdfMerge as Combine,
  GfPdfSplit as Split,
  GfPlus as FilePlus2,
  GfDocument as FileText,
  GfPdfRotate as RotateCw,
  GfSort as ArrowUpDown,
  GfTrash as Trash2,
  GfPdfExtract as Scissors,
  GfPdfCompress as Minimize2,
  GfInfo as Info,
  GfCopyFiles as CopyIcon,
  GfPdfScan as ScanLine,
  GfPdfImages as ImagePlus,
  GfPdfSign as FileSignature,
  GfSearch as Search,
  GfPdfAnnotate as PenLine,
  GfPdfWatermark as Droplet,
  GfPdfText as TypeIcon,
  GfImage as ImageIcon,
  GfPdfConvert as ImagesIcon,
  GfPdfForm as ClipboardList,
  GfConvert as FileInput,
  GfText as FileType2,
  type AppIcon,
} from "@/components/icons";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT, type TFunction, t } from "@/lib/i18n";
import { PdfAnnotator, SignaturePad, type AnnotToolbarItem } from "@/components/pdf/PdfAnnotator";
import {
  newId,
  hexToRgb01,
  dataUrlToBytes,
  imageFileToElementPayload,
  type AnnotElement,
  type TextElement,
  type ImageElement,
} from "@/components/pdf/annot";
import {
  listSignatures,
  saveSignature,
  renameSignature,
  deleteSignature,
  isSignatureCanvasBlank,
  trimSignatureCanvas,
  type StoredSignature,
} from "@/lib/pdf/signatures";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  BottomSheet,
  BottomSheetDefaultsProvider,
  PrimaryButton,
  TextField,
} from "@/components/files/BottomSheet";
import { ProgressDialog } from "@/components/files/ProgressDialog";
import { DestinationPicker } from "@/components/files/DestinationPicker";
import { FileSourcePicker } from "@/components/files/FileSourcePicker";
import { formatSize } from "@/lib/files/format";
import { toAbsolutePath } from "@/lib/files/fs";
import {
  addImageToPdf,
  addTextToPdf,
  compressPdf,
  estimateCompressedSize,
  deletePages,
  duplicatePdf,
  excelToPdf,
  extractPages,
  extractPdfText,
  fillPdfForm,
  filesToPdf,
  imagesToPdf,
  mergePdfs,
  pdfInfo,
  pdfToImages,
  powerpointToPdf,
  readPdfBlobUrl,
  readPdfForm,
  reorderPages,
  rotatePages,
  searchInPdf,
  splitPdf,
  textFileToPdf,
  textToPdf,
  watermarkPdf,
  wordToPdf,
  type CompressionLevel,
  type FormFieldInfo,
  type ImageOverlay,
  type ImageSource,
  type Orientation,
  type PageSize,
  type PdfInfo,
  type Rotation,
  type SearchHit,
  type TextOverlay,
} from "@/lib/pdf/api";
import { resolveTempPath } from "@/lib/pdf/native-io";
import { scanFromCapture } from "@/lib/pdf/scanner";
import { recordPdfOp } from "@/lib/pdf/history";
import { errorMessage } from "@/lib/errors/humanize";
import { nativePlugin } from "@/lib/native/geniusfiles-native";
import type { ProgressEvent as OpProgressEvent } from "@/lib/files/operations";
import { PostCreateActions } from "@/components/pdf/PostCreateActions";
import { useConfirm } from "@/components/common/useConfirm";
import { confirmCopy, progressLabel } from "@/lib/copy";
import { PageThumbGrid, PageCountBadge } from "@/components/pdf/PageThumbGrid";
import { usePdfThumbnails } from "@/components/pdf/usePdfThumbnails";
import { BACK_PRIORITY, useBackHandler } from "@/lib/navigation/back-stack";

export const Route = createFileRoute("/pdf-outils")({
  head: () => ({
    meta: [
      { title: `${t("pdf.meta.titlePrefix")} — GeniusFiles` },
      {
        name: "description",
        content: t("pdf.meta.description"),
      },
    ],
  }),
  component: PdfToolsPage,
});

/* ---------- Tools registry ---------- */

type ToolId =
  | "images-to-pdf"
  | "scan"
  | "text-to-pdf"
  | "files-to-pdf"
  | "merge"
  | "split"
  | "extract"
  | "delete-pages"
  | "reorder"
  | "rotate"
  | "compress"
  | "watermark"
  | "add-text"
  | "add-image"
  | "signature"
  | "fill-form"
  | "pdf-to-images"
  | "extract-text"
  | "search"
  | "duplicate"
  | "info";

type Tool = {
  id: ToolId;
  label: string;
  desc: string;
  icon: AppIcon;
  ready: boolean;
  featured?: boolean;
};

/* Modifier & organiser — le groupe le plus utilisé après les raccourcis. */
function editTools(t: TFunction): Tool[] {
  return [
    {
      id: "merge",
      label: t("pdf.tool.merge.label"),
      desc: t("pdf.tool.merge.desc"),
      icon: Combine,
      ready: true,
    },
    {
      id: "split",
      label: t("pdf.tool.split.label"),
      desc: t("pdf.tool.split.desc"),
      icon: Split,
      ready: true,
    },
    {
      id: "extract",
      label: t("pdf.tool.extract.label"),
      desc: t("pdf.tool.extract.desc"),
      icon: Scissors,
      ready: true,
    },
    {
      id: "delete-pages",
      label: t("pdf.tool.deletePages.label"),
      desc: t("pdf.tool.deletePages.desc"),
      icon: Trash2,
      ready: true,
    },
    {
      id: "reorder",
      label: t("pdf.tool.reorder.label"),
      desc: t("pdf.tool.reorder.desc"),
      icon: ArrowUpDown,
      ready: true,
    },
    {
      id: "rotate",
      label: t("pdf.tool.rotate.label"),
      desc: t("pdf.tool.rotate.desc"),
      icon: RotateCw,
      ready: true,
    },
    {
      id: "compress",
      label: t("pdf.tool.compress.label"),
      desc: t("pdf.tool.compress.desc"),
      icon: Minimize2,
      ready: true,
    },
  ];
}

/* Créer & convertir. */
function createTools(t: TFunction): Tool[] {
  return [
    {
      id: "images-to-pdf",
      label: t("pdf.tool.imagesToPdf.label"),
      desc: t("pdf.tool.imagesToPdf.desc"),
      icon: ImagePlus,
      ready: true,
    },
    {
      id: "scan",
      label: t("pdf.tool.scan.label"),
      desc: t("pdf.tool.scan.desc"),
      icon: ScanLine,
      ready: true,
    },
    {
      id: "text-to-pdf",
      label: t("pdf.tool.textToPdf.label"),
      desc: t("pdf.tool.textToPdf.desc"),
      icon: TypeIcon,
      ready: true,
    },
    {
      id: "files-to-pdf",
      label: t("pdf.tool.filesToPdf.label"),
      desc: t("pdf.tool.filesToPdf.desc"),
      icon: FileInput,
      ready: true,
    },
  ];
}

function annotTools(t: TFunction): Tool[] {
  return [
    {
      id: "watermark",
      label: t("pdf.tool.watermark.label"),
      desc: t("pdf.tool.watermark.desc"),
      icon: Droplet,
      ready: true,
    },
    {
      id: "add-text",
      label: t("pdf.tool.addText.label"),
      desc: t("pdf.tool.addText.desc"),
      icon: PenLine,
      ready: true,
    },
    {
      id: "add-image",
      label: t("pdf.tool.addImage.label"),
      desc: t("pdf.tool.addImage.desc"),
      icon: ImageIcon,
      ready: true,
    },
    {
      id: "signature",
      label: t("pdf.tool.signature.label"),
      desc: t("pdf.tool.signature.desc"),
      icon: FileSignature,
      ready: true,
    },
    {
      id: "fill-form",
      label: t("pdf.tool.fillForm.label"),
      desc: t("pdf.tool.fillForm.desc"),
      icon: ClipboardList,
      ready: true,
    },
  ];
}

/* Extraire & fichier — fusion de deux anciennes sections proches. */
function extractTools(t: TFunction): Tool[] {
  return [
    {
      id: "pdf-to-images",
      label: t("pdf.tool.pdfToImages.label"),
      desc: t("pdf.tool.pdfToImages.desc"),
      icon: ImagesIcon,
      ready: true,
    },
    {
      id: "extract-text",
      label: t("pdf.tool.extractText.label"),
      desc: t("pdf.tool.extractText.desc"),
      icon: FileType2,
      ready: true,
    },
    {
      id: "search",
      label: t("pdf.tool.search.label"),
      desc: t("pdf.tool.search.desc"),
      icon: Search,
      ready: true,
    },
    {
      id: "duplicate",
      label: t("pdf.tool.duplicate.label"),
      desc: t("pdf.tool.duplicate.desc"),
      icon: CopyIcon,
      ready: true,
    },
    {
      id: "info",
      label: t("pdf.tool.info.label"),
      desc: t("pdf.tool.info.desc"),
      icon: Info,
      ready: true,
    },
  ];
}

/* ---------- Page ---------- */

function PdfToolsPage() {
  const t = useT();
  const [tool, setTool] = useState<ToolId | null>(null);

  /* Retour Android : un outil ouvert se referme d'abord et rend la liste
     des outils — jamais de sortie de l'écran PDF ni de l'application. */
  useBackHandler(
    tool !== null,
    () => {
      setTool(null);
      return true;
    },
    BACK_PRIORITY.page,
  );

  return (
    <AppShell>
      <PageHeader title={t("pdf.page.title")} subtitle={t("pdf.page.subtitle")} />

      <ToolSection title={t("pdf.section.edit")} tools={editTools(t)} onOpen={setTool} />
      <ToolSection title={t("pdf.section.create")} tools={createTools(t)} onOpen={setTool} />
      <ToolSection title={t("pdf.section.annotate")} tools={annotTools(t)} onOpen={setTool} />
      <ToolSection title={t("pdf.section.extract")} tools={extractTools(t)} onOpen={setTool} />

      <BottomSheetDefaultsProvider fullScreen>
        <ToolSheet tool={tool} onClose={() => setTool(null)} />
      </BottomSheetDefaultsProvider>
    </AppShell>
  );
}

function ToolSection({
  title,
  tools,
  onOpen,
}: {
  title: string;
  tools: Tool[];
  onOpen: (id: ToolId) => void;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      <ToolGrid tools={tools} onOpen={onOpen} />
    </section>
  );
}

/** Cartes horizontales compactes : icône à gauche, titre + description à
 *  droite. Deux colonnes en mobile, trois dès 480px. */
function ToolGrid({ tools, onOpen }: { tools: Tool[]; onOpen: (id: ToolId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3">
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onOpen(t.id)}
          className="card-surface group flex min-w-0 items-center gap-2.5 p-2.5 text-left transition-transform active:scale-[0.97]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
            <t.icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium leading-[1.2] text-foreground">
              {t.label}
            </span>
            <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
              {t.desc}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Sheet router ---------- */

function ToolSheet({ tool, onClose }: { tool: ToolId | null; onClose: () => void }) {
  if (!tool) return null;
  switch (tool) {
    case "images-to-pdf":
      return <ImagesToPdfSheet onClose={onClose} />;
    case "scan":
      return <ScanSheet onClose={onClose} />;
    case "text-to-pdf":
      return <TextToPdfSheet onClose={onClose} />;
    case "files-to-pdf":
      return <FilesToPdfSheet onClose={onClose} />;
    case "merge":
      return <MergeSheet onClose={onClose} />;
    case "split":
      return <SinglePdfSheet mode="split" onClose={onClose} />;
    case "extract":
      return <SinglePdfSheet mode="extract" onClose={onClose} />;
    case "delete-pages":
      return <SinglePdfSheet mode="delete-pages" onClose={onClose} />;
    case "reorder":
      return <SinglePdfSheet mode="reorder" onClose={onClose} />;
    case "rotate":
      return <SinglePdfSheet mode="rotate" onClose={onClose} />;
    case "compress":
      return <SinglePdfSheet mode="compress" onClose={onClose} />;
    case "watermark":
      return <WatermarkSheet onClose={onClose} />;
    case "add-text":
      return <AddTextSheet onClose={onClose} />;
    case "add-image":
      return <AddImageSheet mode="image" onClose={onClose} />;
    case "signature":
      return <AddImageSheet mode="signature" onClose={onClose} />;
    case "fill-form":
      return <FillFormSheet onClose={onClose} />;
    case "pdf-to-images":
      return <PdfToImagesSheet onClose={onClose} />;
    case "extract-text":
      return <ExtractTextSheet onClose={onClose} />;
    case "search":
      return <SearchSheet onClose={onClose} />;
    case "duplicate":
      return <SinglePdfSheet mode="duplicate" onClose={onClose} />;
    case "info":
      return <SinglePdfSheet mode="info" onClose={onClose} />;
    default:
      return null;
  }
}

/* ---------- Progress hook ---------- */

function useJob() {
  const t = useT();
  const [progress, setProgress] = useState<OpProgressEvent | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const start = () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setProgress({
      completed: 0,
      total: 0,
      bytes: 0,
      totalBytes: 0,
      currentName: t("pdf.job.preparing"),
      elapsedMs: 0,
    });
    return ctrl;
  };

  const update = (p: {
    completed: number;
    total: number;
    currentName?: string;
    elapsedMs: number;
    etaMs?: number;
  }) => {
    setProgress({
      completed: p.completed,
      total: p.total,
      bytes: 0,
      totalBytes: 0,
      currentName: p.currentName ?? t("pdf.job.ellipsis"),
      elapsedMs: p.elapsedMs,
      etaMs: p.etaMs,
    });
  };

  const stop = () => {
    setRunning(false);
    setProgress(null);
    abortRef.current = null;
  };

  const cancel = () => abortRef.current?.abort();

  return { progress, running, start, update, stop, cancel };
}

/** Vrai si un fichier existe déjà à ce chemin (pour prévenir un écrasement). */
async function fileExists(path: string): Promise<boolean> {
  const p = nativePlugin();
  if (!p) return false;
  try {
    await p.stat({ path });
    return true;
  } catch {
    return false;
  }
}

/* ---------- Images → PDF ---------- */

function ImagesToPdfSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [images, setImages] = useState<{ id: string; src: ImageSource; url: string }[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [compression, setCompression] = useState<CompressionLevel>("medium");
  const [name, setName] = useState("document.pdf");
  const [destination, setDestination] = useState<{ rootId: string; segments: string[] } | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [gfPickerOpen, setGfPickerOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const job = useJob();
  const confirm = useConfirm();

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const added: typeof images = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      added.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        src: { kind: "file", file: f, name: f.name },
        url: URL.createObjectURL(f),
      });
    }
    setImages((prev) => [...prev, ...added]);
  };

  useEffect(() => {
    return () => {
      images.forEach((i) => URL.revokeObjectURL(i.url));
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = (idx: number, delta: number) => {
    setImages((prev) => {
      const next = [...prev];
      const j = idx + delta;
      if (j < 0 || j >= next.length) return prev;
      const [it] = next.splice(idx, 1);
      next.splice(j, 0, it);
      return next;
    });
  };
  const remove = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const generate = async (savePath?: string) => {
    const ctrl = job.start();
    try {
      const tmpDest =
        savePath ??
        (destination
          ? `${toAbsolutePath({ rootId: destination.rootId as never, segments: destination.segments })}/${name || "document.pdf"}`
          : resolveTempPath(name || "document.pdf"));
      const res = await imagesToPdf(
        images.map((i) => i.src),
        tmpDest,
        { pageSize, orientation, compression },
        {
          signal: ctrl.signal,
          onProgress: (p) => job.update(p),
        },
      );
      recordPdfOp({
        kind: "images-to-pdf",
        summary: t("pdf.summary.imagesToPdf", { count: images.length }),
        sources: images.map((i) => i.src.name),
        outputs: [res.path],
      });
      toast.success(t("pdf.post.title"), {
        description: t("pdf.pageSize", { count: res.pageCount, size: formatSize(res.size) }),
      });
      return res.path;
    } catch (e) {
      if ((e as Error).name === "AbortError") toast.info(t("pdf.toast.cancelled"));
      else toast.error(errorMessage(e, t("pdf.error.generic")));
      return null;
    } finally {
      job.stop();
    }
  };

  const preview = async () => {
    if (images.length === 0) return;
    const tmpPath = resolveTempPath(`preview-${Date.now()}.pdf`);
    const path = await generate(tmpPath);
    if (!path) return;
    try {
      const url = await readPdfBlobUrl(path);
      setPreviewUrl(url);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <BottomSheet
        open={!pickerOpen && !gfPickerOpen && !job.running && !createdPath}
        onClose={onClose}
        title={t("pdf.creerUnPdfDepuisDesImages")}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              {t("action.close")}
            </PrimaryButton>
            <PrimaryButton variant="ghost" onClick={preview} disabled={images.length === 0}>
              {t("organize.preview.defaultTitle")}
            </PrimaryButton>
            <PrimaryButton
              onClick={() => setPickerOpen(true)}
              disabled={images.length === 0 || !name.trim()}
            >
              {t("pdf.enregistrer")}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-dashed border-border p-4 text-center text-[12px] text-muted-foreground hover:text-foreground"
            >
              <ImagesIcon className="mx-auto mb-1 h-5 w-5" />
              {t("pdf.depuisLaGalerie")}
            </button>
            <button
              type="button"
              onClick={() => setGfPickerOpen(true)}
              className="rounded-xl border border-dashed border-border p-4 text-center text-[12px] text-muted-foreground hover:text-foreground"
            >
              <FilePlus2 className="mx-auto mb-1 h-5 w-5" />
              {t("pdf.imagesToPdf.fromGf")}
            </button>
          </div>

          {images.length > 0 ? (
            <div className="space-y-1.5">
              {images.map((img, i) => (
                <div
                  key={img.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2"
                >
                  <span className="w-5 text-center text-[11px] text-muted-foreground">{i + 1}</span>
                  <img src={img.url} alt="" className="h-10 w-10 rounded object-cover" />
                  <span className="flex-1 truncate text-[12px]">{img.src.name}</span>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={t("pdf.aria.moveUp")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, +1)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={t("pdf.aria.moveDown")}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="rounded p-1 text-muted-foreground hover:text-red-500"
                    aria-label={t("pdf.aria.remove")}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <Select
              label={t("pdf.field.format")}
              value={pageSize}
              onChange={(v) => setPageSize(v as PageSize)}
              options={[
                ["A4", "A4"],
                ["Letter", "Letter"],
                ["Legal", "Legal"],
                ["A3", "A3"],
                ["A5", "A5"],
              ]}
            />
            <Select
              label={t("pdf.field.orientation")}
              value={orientation}
              onChange={(v) => setOrientation(v as Orientation)}
              options={[
                ["portrait", t("pdf.orientation.portrait")],
                ["landscape", t("pdf.orientation.landscape")],
              ]}
            />
            <Select
              label={t("pdf.field.compression")}
              value={compression}
              onChange={(v) => setCompression(v as CompressionLevel)}
              options={[
                ["low", t("pdf.compression.low")],
                ["medium", t("pdf.compression.medium")],
                ["high", t("pdf.compression.high")],
              ]}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {t("media.editor.fileNamePlaceholder")}
            </label>
            <TextField value={name} onChange={setName} placeholder="document.pdf" />
          </div>
        </div>
      </BottomSheet>

      <FileSourcePicker
        open={gfPickerOpen}
        title={t("pdf.choisirDesImages")}
        extensions={["jpg", "jpeg", "png", "webp", "bmp", "gif", "heic"]}
        multi
        onCancel={() => setGfPickerOpen(false)}
        onConfirm={async (paths) => {
          setGfPickerOpen(false);
          const { readBytes } = await import("@/lib/pdf/native-io");
          const added: typeof images = [];
          for (const p of paths) {
            try {
              const bytes = await readBytes(p);
              const name = p.split("/").pop() ?? "image";
              const ext = name.split(".").pop()?.toLowerCase() ?? "jpg";
              const mime =
                ext === "png"
                  ? "image/png"
                  : ext === "webp"
                    ? "image/webp"
                    : ext === "bmp"
                      ? "image/bmp"
                      : ext === "gif"
                        ? "image/gif"
                        : "image/jpeg";
              const blob = new Blob([bytes as BlobPart], { type: mime });
              added.push({
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                src: { kind: "blob", blob, name },
                url: URL.createObjectURL(blob),
              });
            } catch {
              toast.error(t("pdf.impossibleOuvrirFichier", { name: p.split("/").pop() ?? "" }), {
                description: t("pdf.leFichierEstPeutEtreCorrompu"),
              });
            }
          }
          if (added.length) setImages((prev) => [...prev, ...added]);
        }}
      />

      <DestinationPicker
        open={pickerOpen}
        title={t("pdf.enregistrerLePdfDans")}
        initial={null}
        onCancel={() => setPickerOpen(false)}
        onConfirm={async (dest) => {
          setPickerOpen(false);
          setDestination(dest);
          const finalName = name.endsWith(".pdf") ? name : `${name}.pdf`;
          const abs = `${toAbsolutePath(dest)}/${finalName}`;
          const proceed = async () => {
            const path = await generate(abs);
            if (path) setCreatedPath(path);
          };
          if (await fileExists(abs)) confirm.ask(confirmCopy.overwriteFile(finalName), proceed);
          else await proceed();
        }}
      />
      {confirm.dialog}

      <ProgressDialog
        open={job.running}
        title={t("pdf.creationDuPdf")}
        progress={job.progress}
        onCancel={job.cancel}
      />

      {previewUrl ? (
        <BottomSheet
          open
          onClose={() => {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }}
          title={t("organize.preview.defaultTitle")}
          footer={
            <PrimaryButton
              variant="ghost"
              onClick={() => {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }}
            >
              {t("action.close")}
            </PrimaryButton>
          }
        >
          <iframe
            src={previewUrl}
            title={t("pdf.apercuPdf")}
            className="h-[60vh] w-full rounded-lg border border-border bg-black"
          />
        </BottomSheet>
      ) : null}

      {createdPath ? (
        <PostCreateActions
          path={createdPath}
          onClose={() => {
            setCreatedPath(null);
            onClose();
          }}
          onPathChanged={setCreatedPath}
        />
      ) : null}
    </>
  );
}

/* ---------- Scanner ---------- */

function ScanSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [pages, setPages] = useState<{ id: string; blob: Blob; url: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("scan.pdf");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const job = useJob();
  const confirm = useConfirm();

  useEffect(
    () => () => {
      pages.forEach((p) => URL.revokeObjectURL(p.url));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleCapture = async (file: File | null) => {
    if (!file) return;
    try {
      const { blob } = await scanFromCapture(file);
      const url = URL.createObjectURL(blob);
      setPages((prev) => [
        ...prev,
        { id: `${Date.now()}`, blob, url, name: file.name || `page-${prev.length + 1}.jpg` },
      ]);
    } catch (e) {
      toast.error(errorMessage(e, t("pdf.impossibleDUtiliserLaCapture")));
    }
  };

  const movePage = (idx: number, delta: number) => {
    setPages((prev) => {
      const next = [...prev];
      const j = idx + delta;
      if (j < 0 || j >= next.length) return prev;
      const [it] = next.splice(idx, 1);
      next.splice(j, 0, it);
      return next;
    });
  };

  const finish = async (dest: { rootId: string; segments: string[] }) => {
    if (pages.length === 0) return;
    const ctrl = job.start();
    const abs = `${toAbsolutePath({ rootId: dest.rootId as never, segments: dest.segments })}/${
      name.endsWith(".pdf") ? name : `${name}.pdf`
    }`;
    try {
      const res = await imagesToPdf(
        pages.map((p) => ({ kind: "blob" as const, blob: p.blob, name: p.name })),
        abs,
        { pageSize, orientation, compression: "medium" },
        { signal: ctrl.signal, onProgress: (p) => job.update(p) },
      );
      recordPdfOp({
        kind: "scan",
        summary: t("pdf.scan.opSummary", { count: pages.length }),
        sources: pages.map((p) => p.name),
        outputs: [res.path],
      });
      toast.success(t("pdf.scanEnregistre"), {
        description: t("pdf.scan.resultDesc", { count: res.pageCount }),
      });
      setCreatedPath(res.path);
    } catch (e) {
      if ((e as Error).name === "AbortError") toast.info(t("pdf.toast.cancelled"));
      else toast.error(errorMessage(e, t("pdf.error.generic")));
    } finally {
      job.stop();
    }
  };

  return (
    <>
      <BottomSheet
        open={!pickerOpen && !job.running && !createdPath}
        onClose={onClose}
        title={t("pdf.scan.sheetTitle")}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              {t("action.close")}
            </PrimaryButton>
            <PrimaryButton
              onClick={() => setPickerOpen(true)}
              disabled={pages.length === 0 || !name.trim()}
            >
              {t("pdf.enregistrer")}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleCapture(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-border p-4 text-center text-[13px] hover:text-foreground"
          >
            <ScanLine className="mx-auto mb-1 h-5 w-5 text-primary" />
            {pages.length === 0 ? t("pdf.scan.capturePage") : t("pdf.scan.addPage")}
          </button>
          <p className="text-[11px] text-muted-foreground">{t("pdf.scan.hint")}</p>
          {pages.length > 0 ? (
            <div className="space-y-1.5">
              {pages.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2"
                >
                  <span className="w-5 text-center text-[11px] text-muted-foreground">{i + 1}</span>
                  <img src={p.url} alt="" className="h-12 w-12 rounded object-cover" />
                  <span className="flex-1 truncate text-[12px]">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => movePage(i, -1)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={t("pdf.aria.moveUp")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => movePage(i, +1)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={t("pdf.aria.moveDown")}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(p.url);
                      setPages((prev) => prev.filter((x) => x.id !== p.id));
                    }}
                    className="rounded p-1 text-muted-foreground hover:text-red-500"
                    aria-label={t("pdf.aria.remove")}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Select
              label={t("pdf.field.format")}
              value={pageSize}
              onChange={(v) => setPageSize(v as PageSize)}
              options={[
                ["A4", "A4"],
                ["Letter", "Letter"],
                ["Legal", "Legal"],
                ["A3", "A3"],
                ["A5", "A5"],
              ]}
            />
            <Select
              label={t("pdf.field.orientation")}
              value={orientation}
              onChange={(v) => setOrientation(v as Orientation)}
              options={[
                ["portrait", t("pdf.orientation.portrait")],
                ["landscape", t("pdf.orientation.landscape")],
              ]}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {t("pdf.nomDuPdf")}
            </label>
            <TextField value={name} onChange={setName} placeholder="scan.pdf" />
          </div>
        </div>
      </BottomSheet>

      <DestinationPicker
        open={pickerOpen}
        title={t("files.archive.saveInto")}
        initial={null}
        onCancel={() => setPickerOpen(false)}
        onConfirm={async (d) => {
          setPickerOpen(false);
          const finalName = name.endsWith(".pdf") ? name : `${name}.pdf`;
          const abs = `${toAbsolutePath({ rootId: d.rootId as never, segments: d.segments })}/${finalName}`;
          if (await fileExists(abs))
            confirm.ask(confirmCopy.overwriteFile(finalName), () => finish(d));
          else finish(d);
        }}
      />
      {confirm.dialog}

      <ProgressDialog
        open={job.running}
        title={t("pdf.scan.savingTitle")}
        progress={job.progress}
        onCancel={job.cancel}
      />

      {createdPath ? (
        <PostCreateActions
          path={createdPath}
          onClose={() => {
            setCreatedPath(null);
            onClose();
          }}
          onPathChanged={setCreatedPath}
        />
      ) : null}
    </>
  );
}

/* ---------- Merge ---------- */

function MergeSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [sources, setSources] = useState<
    { path: string; pageCount: number | null; size: number | null }[]
  >([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sourcePicker, setSourcePicker] = useState(false);
  const [destPicker, setDestPicker] = useState(false);
  const [name, setName] = useState("fusion.pdf");
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const job = useJob();

  // Fetch page counts + size for each newly added source (visual metadata).
  useEffect(() => {
    const pending = sources.filter((s) => s.pageCount == null);
    if (pending.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const s of pending) {
        try {
          const info = await pdfInfo(s.path);
          if (cancelled) return;
          setSources((prev) =>
            prev.map((x) =>
              x.path === s.path ? { ...x, pageCount: info.pageCount, size: info.size } : x,
            ),
          );
        } catch {
          if (cancelled) return;
          setSources((prev) =>
            prev.map((x) => (x.path === s.path ? { ...x, pageCount: 0, size: 0 } : x)),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sources]);

  const totalPages = sources.reduce((n, s) => n + (s.pageCount ?? 0), 0);

  const move = (idx: number, delta: number) => {
    setSources((prev) => {
      const next = [...prev];
      const j = idx + delta;
      if (j < 0 || j >= next.length) return prev;
      const [it] = next.splice(idx, 1);
      next.splice(j, 0, it);
      return next;
    });
  };

  const finish = async (dest: { rootId: string; segments: string[] }) => {
    const ctrl = job.start();
    const abs = `${toAbsolutePath({ rootId: dest.rootId as never, segments: dest.segments })}/${
      name.endsWith(".pdf") ? name : `${name}.pdf`
    }`;
    try {
      const res = await mergePdfs(
        sources.map((s) => s.path),
        abs,
        {
          signal: ctrl.signal,
          onProgress: (p) => job.update(p),
        },
      );
      recordPdfOp({
        kind: "merge",
        summary: t("pdf.merge.opSummary", { count: sources.length }),
        sources: sources.map((s) => s.path),
        outputs: [res.path],
      });
      toast.success(t("pdf.fusionTerminee"), {
        description: t("pdf.merge.resultDesc", { files: sources.length, pages: res.pageCount }),
      });
      setCreatedPath(res.path);
    } catch (e) {
      if ((e as Error).name === "AbortError") toast.info(t("pdf.toast.cancelled"));
      else toast.error(errorMessage(e, t("pdf.error.generic")));
    } finally {
      job.stop();
    }
  };

  return (
    <>
      <BottomSheet
        open={!sourcePicker && !destPicker && !job.running && !expanded && !createdPath}
        onClose={onClose}
        title={t("pdf.fusionnerDesPdf")}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              {t("action.close")}
            </PrimaryButton>
            <PrimaryButton
              onClick={() => setDestPicker(true)}
              disabled={sources.length < 2 || !name.trim()}
            >
              {t("pdf.merge.cta")}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSourcePicker(true)}
            className="w-full rounded-xl border border-dashed border-border p-4 text-center text-[13px] hover:text-foreground"
          >
            <FilePlus2 className="mx-auto mb-1 h-5 w-5" />
            {t("pdf.ajouterDesPdf")}
          </button>
          {sources.length > 0 ? (
            <>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>X_PLACEHOLDER_MERGE_SUMMARY</span>
              </div>
              <ul className="space-y-1.5">
                {sources.map((s, i) => (
                  <li
                    key={s.path + i}
                    className="rounded-lg border border-border bg-surface p-2 text-[12px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-center text-muted-foreground">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{s.path.split("/").pop()}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {s.pageCount == null
                            ? t("pdf.analyseEnCours")
                            : `${s.pageCount} page(s)${s.size ? ` · ${formatSize(s.size)}` : ""}`}
                        </div>
                      </div>
                      <button
                        onClick={() => setExpanded(s.path)}
                        className="rounded-md border border-border px-2 py-1 text-[10px]"
                        title={t("organize.preview.defaultTitle")}
                      >
                        {t("organize.preview.defaultTitle")}
                      </button>
                      <button onClick={() => move(i, -1)} className="px-1">
                        ↑
                      </button>
                      <button onClick={() => move(i, +1)} className="px-1">
                        ↓
                      </button>
                      <button
                        onClick={() => setSources((p) => p.filter((_, j) => j !== i))}
                        className="px-1 text-muted-foreground"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={Combine}
              title={t("pdf.aucunPdfSelectionne")}
              description={t("pdf.ajoutezAuMoinsDeuxFichiers")}
            />
          )}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {t("pdf.nomDuFichierFusionne")}
            </label>
            <TextField value={name} onChange={setName} placeholder="fusion.pdf" />
          </div>
        </div>
      </BottomSheet>

      {/* Per-file thumbnail preview overlay */}
      <BottomSheet
        open={!!expanded}
        onClose={() => setExpanded(null)}
        title={expanded ? (expanded.split("/").pop() ?? t("pdf.apercuPdf")) : ""}
        footer={
          <PrimaryButton variant="ghost" onClick={() => setExpanded(null)}>
            {t("action.close")}
          </PrimaryButton>
        }
      >
        {expanded ? <ThumbPreview source={expanded} /> : null}
      </BottomSheet>

      <FileSourcePicker
        open={sourcePicker}
        title={t("pdf.choisirDesPdf")}
        extensions={["pdf"]}
        multi
        onCancel={() => setSourcePicker(false)}
        onConfirm={(paths) => {
          setSourcePicker(false);
          setSources((prev) => [
            ...prev,
            ...paths.map((p) => ({ path: p, pageCount: null, size: null })),
          ]);
        }}
      />
      <DestinationPicker
        open={destPicker}
        title={t("files.archive.saveInto")}
        initial={null}
        onCancel={() => setDestPicker(false)}
        onConfirm={(d) => {
          setDestPicker(false);
          finish(d);
        }}
      />
      <ProgressDialog
        open={job.running}
        title={t("pdf.merge.progressTitle")}
        progress={job.progress}
        onCancel={job.cancel}
      />
      {createdPath ? (
        <PostCreateActions
          path={createdPath}
          onClose={() => {
            setCreatedPath(null);
            onClose();
          }}
          onPathChanged={setCreatedPath}
        />
      ) : null}
    </>
  );
}

/**
 * Read-only thumbnail preview used by the merge sheet to peek at any
 * added source file without leaving the flow.
 */
function ThumbPreview({ source }: { source: string }) {
  const { thumbs, pageCount, loading } = usePdfThumbnails(source);
  return (
    <div className="space-y-2">
      <PageCountBadge loading={loading} loaded={thumbs.length} total={pageCount} />
      <div className="max-h-[60vh] overflow-y-auto">
        <PageThumbGrid thumbs={thumbs} />
      </div>
    </div>
  );
}

/* ---------- Shared single-PDF sheet ---------- */

type SingleMode =
  | "split"
  | "extract"
  | "delete-pages"
  | "reorder"
  | "rotate"
  | "compress"
  | "rename"
  | "duplicate"
  | "share"
  | "info";

function SinglePdfSheet({ mode, onClose }: { mode: SingleMode; onClose: () => void }) {
  const t = useT();
  const [source, setSource] = useState<string | null>(null);
  const [info, setInfo] = useState<PdfInfo | null>(null);
  const [sourcePicker, setSourcePicker] = useState(true);
  const [destPicker, setDestPicker] = useState(false);
  const [pending, setPending] = useState<
    ((d: { rootId: string; segments: string[] }) => void) | null
  >(null);
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const [createdPaths, setCreatedPaths] = useState<string[] | null>(null);
  const job = useJob();
  const confirm = useConfirm();

  // Per-mode state (only the relevant ones are read).
  const [order, setOrder] = useState<number[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [splitMode, setSplitMode] = useState<"single" | "ranges" | "size">("ranges");
  const [splitSize, setSplitSize] = useState("5");
  const [rangesText, setRangesText] = useState("1-3, 4-");
  const [rotations, setRotations] = useState<Record<number, Rotation>>({});
  const [compression, setCompression] = useState<CompressionLevel>("medium");
  const [newName, setNewName] = useState("");

  // Load PDF metadata whenever the source changes.
  useEffect(() => {
    if (!source) return;
    pdfInfo(source)
      .then((i) => {
        setInfo(i);
        setOrder(Array.from({ length: i.pageCount }, (_, k) => k + 1));
        setSelected(new Set());
        setRotations({});
        setNewName(source.split("/").pop() ?? "");
      })
      .catch((e) =>
        toast.error(errorMessage(e, t("pdf.error.openPdf")), {
          description: t("pdf.error.openPdf.desc"),
        }),
      );
  }, [source, t]);

  // Progressive thumbnails for the visual editors.
  const needThumbs =
    mode === "split" ||
    mode === "extract" ||
    mode === "delete-pages" ||
    mode === "reorder" ||
    mode === "rotate";
  const { thumbs, pageCount, loading: thumbLoading } = usePdfThumbnails(needThumbs ? source : null);

  const toggleSelect = (p: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const setRotationForSelection = (rot: Rotation) => {
    const target = selected.size ? Array.from(selected) : order;
    setRotations((prev) => {
      const next = { ...prev };
      for (const p of target) next[p] = rot;
      return next;
    });
    toast.success(
      selected.size ? `${target.length} page(s) → ${rot}°` : `Toutes les pages → ${rot}°`,
    );
  };

  // Build split ranges from the chosen split mode.
  const computeSplitRanges = (max: number): number[][] => {
    if (splitMode === "single") {
      return Array.from({ length: max }, (_, i) => [i + 1, i + 1]);
    }
    if (splitMode === "size") {
      const size = Math.max(1, parseInt(splitSize, 10) || 1);
      const out: number[][] = [];
      for (let i = 1; i <= max; i += size) out.push([i, Math.min(max, i + size - 1)]);
      return out;
    }
    // ranges text
    return rangesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((seg) => {
        const [a, b] = seg.split("-").map((x) => x.trim());
        const start = Math.max(1, parseInt(a || "1", 10) || 1);
        const end = b ? Math.min(max, parseInt(b, 10) || max) : max;
        return [start, Math.max(start, end)];
      })
      .filter(([a, b]) => a <= max && b >= a);
  };

  const withDest = (fn: (d: { rootId: string; segments: string[] }) => void) => {
    setPending(() => fn);
    setDestPicker(true);
  };

  const runToDest = async (
    d: { rootId: string; segments: string[] },
    suffix: string,
    executor: (destPath: string, ctrl: AbortController) => Promise<void>,
  ) => {
    if (!source || !info) return;
    const ctrl = job.start();
    const base = (source.split("/").pop() ?? "document.pdf").replace(/\.pdf$/i, "");
    const abs = `${toAbsolutePath({ rootId: d.rootId as never, segments: d.segments })}/${base}${suffix}.pdf`;
    try {
      await executor(abs, ctrl);
    } catch (e) {
      if ((e as Error).name === "AbortError") toast.info(t("pdf.toast.cancelled"));
      else toast.error(errorMessage(e, t("pdf.error.generic")));
    } finally {
      job.stop();
    }
  };

  const doAction = async (d: { rootId: string; segments: string[] }) => {
    if (!source || !info) return;
    switch (mode) {
      case "split": {
        const ranges = computeSplitRanges(info.pageCount);
        if (ranges.length === 0)
          return toast.error(t("pdf.plagesIncorrectes"), {
            description: t("pdf.formatPlagesExemple"),
          });
        await runToDest(d, "", async (_dest, ctrl) => {
          const res = await splitPdf(
            source,
            ranges,
            toAbsolutePath({ rootId: d.rootId as never, segments: d.segments }),
            (source.split("/").pop() ?? "document").replace(/\.pdf$/i, ""),
            { signal: ctrl.signal, onProgress: (p) => job.update(p) },
          );
          recordPdfOp({
            kind: "split",
            summary: t("pdf.split.opSummary", { count: res.files.length }),
            sources: [source],
            outputs: res.files.map((f) => f.path),
          });
          toast.success(t("pdf.divisionTerminee"), {
            description: t("pdf.split.resultDesc", { count: res.files.length }),
          });
          const paths = res.files.map((f) => f.path);
          if (paths.length === 1) setCreatedPath(paths[0]);
          else setCreatedPaths(paths);
        });
        break;
      }
      case "extract": {
        const list = Array.from(selected).sort((a, b) => a - b);
        if (list.length === 0)
          return toast.error(t("pdf.aucunePageSelectionnee"), {
            description: t("pdf.choisissezAuMoinsUnePageA"),
          });
        await runToDest(d, "_extrait", async (dest, ctrl) => {
          const res = await extractPages(source, list, dest, {
            signal: ctrl.signal,
            onProgress: (p) => job.update(p),
          });
          recordPdfOp({
            kind: "extract",
            summary: t("pdf.summary.pagesExtracted", { count: list.length }),
            sources: [source],
            outputs: [res.path],
          });
          toast.success(t("pdf.extractionTerminee"), {
            description: t("pdf.extractionTermineeDesc", { count: res.pageCount }),
          });
          setCreatedPath(res.path);
        });
        break;
      }
      case "delete-pages": {
        const list = Array.from(selected).sort((a, b) => a - b);
        if (list.length === 0)
          return toast.error(t("pdf.aucunePageSelectionnee"), {
            description: t("pdf.choisissezAuMoinsUnePageA2"),
          });
        if (list.length >= info.pageCount)
          return toast.error(t("pdf.impossibleDeToutSupprimer"), {
            description: t("pdf.lePdfDoitConserverAuMoins"),
          });
        await new Promise<void>((resolve) =>
          confirm.ask(confirmCopy.deletePages(list.length), () => resolve()),
        );
        await runToDest(d, "_nettoye", async (dest, ctrl) => {
          const res = await deletePages(source, list, dest, {
            signal: ctrl.signal,
            onProgress: (p) => job.update(p),
          });
          recordPdfOp({
            kind: "delete-pages",
            summary: t("pdf.summary.pagesDeleted", { count: list.length }),
            sources: [source],
            outputs: [res.path],
          });
          toast.success(t("pdf.pagesSupprimees"), {
            description: t("pdf.pdfContientPages", { count: res.pageCount }),
          });
          setCreatedPath(res.path);
        });
        break;
      }
      case "reorder": {
        await runToDest(d, "_reorganise", async (dest, ctrl) => {
          const res = await reorderPages(source, order, dest, {
            signal: ctrl.signal,
            onProgress: (p) => job.update(p),
          });
          recordPdfOp({
            kind: "reorder",
            summary: t("pdf.summary.pagesReordered"),
            sources: [source],
            outputs: [res.path],
          });
          toast.success(t("pdf.ordreDesPagesMisAJour"), {
            description: t("pdf.leNouveauPdfAEteEnregistre"),
          });
          setCreatedPath(res.path);
        });
        break;
      }
      case "rotate": {
        if (Object.keys(rotations).length === 0)
          return toast.error(t("pdf.aucuneRotationChoisie"), {
            description: t("pdf.indiquezUneRotationPourAuMoins"),
          });
        await runToDest(d, "_pivote", async (dest, ctrl) => {
          const res = await rotatePages(source, rotations, dest, {
            signal: ctrl.signal,
            onProgress: (p) => job.update(p),
          });
          recordPdfOp({
            kind: "rotate",
            summary: t("pdf.summary.pagesRotated", { count: Object.keys(rotations).length }),
            sources: [source],
            outputs: [res.path],
          });
          toast.success(t("pdf.rotationAppliquee"), {
            description: t("pdf.lePdfPivoteAEteEnregistre"),
          });
          setCreatedPath(res.path);
        });
        break;
      }
      case "compress": {
        await runToDest(d, "_compresse", async (dest, ctrl) => {
          const res = await compressPdf(source, dest, compression, {
            signal: ctrl.signal,
            onProgress: (p) => job.update(p),
          });
          const pct = Math.round(res.ratio * 100);
          recordPdfOp({
            kind: "compress",
            summary: t("pdf.summary.compression", { level: compression, pct: String(pct) }),
            sources: [source],
            outputs: [res.path],
          });
          toast.success(t("pdf.compressionTerminee"), {
            description: t("pdf.nouveauPoids", {
              size: formatSize(res.size),
              gain: String(Math.max(0, 100 - pct)),
            }),
          });
          setCreatedPath(res.path);
        });
        break;
      }
      case "duplicate": {
        const base = (source.split("/").pop() ?? "document.pdf").replace(/\.pdf$/i, "");
        const abs = `${toAbsolutePath({ rootId: d.rootId as never, segments: d.segments })}/${base}_copie.pdf`;
        try {
          const res = await duplicatePdf(source, abs);
          recordPdfOp({
            kind: "duplicate",
            summary: t("pdf.copie"),
            sources: [source],
            outputs: [res.path],
          });
          toast.success(t("pdf.copieCreee"), { description: t("pdf.lePdfAEteDupliqueAvec") });
          setCreatedPath(res.path);
        } catch (e) {
          toast.error(errorMessage(e, t("pdf.error.generic")));
        }
        break;
      }
      default:
        break;
    }
  };

  const doRename = async () => {
    if (!source || !newName.trim()) return;
    try {
      const p = nativePlugin();
      if (p) {
        const res = await p.renamePath({ path: source, newName: newName.trim() });
        recordPdfOp({
          kind: "rename",
          summary: t("pdf.summary.renamed", { name: newName.trim() }),
          sources: [source],
          outputs: [res.path],
        });
        try {
          window.dispatchEvent(new CustomEvent("gf:storage-changed"));
        } catch {
          /* ignore */
        }
        toast.success(t("pdf.renomme"));
        onClose();
      } else {
        toast.info(t("pdf.renommageDisponibleSurAppareil"));
        onClose();
      }
    } catch (e) {
      toast.error(errorMessage(e, t("pdf.error.generic")));
    }
  };

  const doShare = async () => {
    if (!source) return;
    try {
      const p = nativePlugin();
      if (p) await p.shareFiles({ paths: [source] });
      else toast.info(t("pdf.partageDisponibleSurAppareil"));
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, t("pdf.error.generic")));
    }
  };

  const title: Record<SingleMode, string> = {
    split: t("pdf.sheetTitle.split"),
    extract: t("pdf.tool.extract.label"),
    "delete-pages": t("pdf.tool.deletePages.label"),
    reorder: t("pdf.sheetTitle.reorder"),
    rotate: t("pdf.tool.rotate.label"),
    compress: t("pdf.tool.compress.label"),
    rename: t("pdf.post.rename"),
    duplicate: t("pdf.tool.duplicate.label"),
    share: t("pdf.post.share"),
    info: t("pdf.tool.info.label"),
  };

  const cta =
    mode === "info" ? null : mode === "rename" ? (
      <PrimaryButton onClick={doRename} disabled={!source || !info || !newName.trim()}>
        {t("pdf.post.rename")}
      </PrimaryButton>
    ) : mode === "share" ? (
      <PrimaryButton onClick={doShare} disabled={!source || !info}>
        {t("action.share")}
      </PrimaryButton>
    ) : (
      <PrimaryButton onClick={() => withDest(doAction)} disabled={!source || !info}>
        {t("pdf.enregistrer")}
      </PrimaryButton>
    );

  const body = (() => {
    if (!source)
      return (
        <EmptyState
          icon={FileText}
          title={t("pdf.selectionnezUnPdf")}
          description={t("pdf.choisissezUnFichierDepuisVotreAppareil")}
        />
      );
    if (!info)
      return <p className="py-4 text-center text-[12px] text-muted-foreground">Analyse…</p>;

    switch (mode) {
      case "split":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {t("pdf.pageCount", { count: info.pageCount })}
              </span>
              <PageCountBadge
                loading={thumbLoading}
                loaded={thumbs.length}
                total={pageCount || info.pageCount}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              {(
                [
                  ["single", t("pdf.splitMode.single")],
                  ["size", t("pdf.splitMode.size")],
                  ["ranges", t("pdf.splitMode.ranges")],
                ] as const
              ).map(([v, lbl]) => (
                <button
                  key={v}
                  onClick={() => setSplitMode(v)}
                  className={`rounded-lg border px-2 py-2 ${
                    splitMode === v
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-surface"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {splitMode === "size" ? (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  {t("pdf.pagesParFichier")}
                </label>
                <TextField value={splitSize} onChange={setSplitSize} />
              </div>
            ) : null}
            {splitMode === "ranges" ? (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  {t("pdf.plagesExempleLabel")}
                </label>
                <TextField value={rangesText} onChange={setRangesText} />
              </div>
            ) : null}
            <div className="max-h-[42vh] overflow-y-auto">
              <PageThumbGrid thumbs={thumbs} />
            </div>
          </div>
        );
      case "extract":
      case "delete-pages": {
        const isExtract = mode === "extract";
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {selected.size} / {info.pageCount} sélectionnée(s)
              </span>
              <div className="flex gap-2">
                <button
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() =>
                    setSelected(new Set(Array.from({ length: info.pageCount }, (_, i) => i + 1)))
                  }
                >
                  {t("action.selectAll")}
                </button>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setSelected(new Set())}
                >
                  {t("pdf.effacer")}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t(isExtract ? "pdf.touchezLesPagesAExtraire" : "pdf.touchezLesPagesASupprimer")}
            </p>
            <div className="max-h-[52vh] overflow-y-auto">
              <PageThumbGrid thumbs={thumbs} selected={selected} onToggleSelect={toggleSelect} />
            </div>
          </div>
        );
      }
      case "reorder":
        return (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              {t("pdf.glissezDeposezLesPagesPourLes")}
            </p>
            <div className="max-h-[58vh] overflow-y-auto">
              <PageThumbGrid thumbs={thumbs} order={order} onReorder={setOrder} />
            </div>
          </div>
        );
      case "rotate":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {selected.size
                  ? t("pdf.pagesSelectionnees", { count: selected.size })
                  : t("pdf.aucuneSelectionToutesLesPages")}
              </span>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSelected(new Set())}
              >
                Effacer
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 text-[11px]">
              {([0, 90, 180, 270] as Rotation[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRotationForSelection(r)}
                  className="rounded-lg border border-border bg-surface py-2 hover:text-foreground"
                >
                  {r}°
                </button>
              ))}
            </div>
            <div className="max-h-[46vh] overflow-y-auto">
              <PageThumbGrid
                thumbs={thumbs}
                rotations={rotations}
                selected={selected}
                onToggleSelect={toggleSelect}
              />
            </div>
          </div>
        );
      case "compress": {
        const est = estimateCompressedSize(info.size, compression);
        const pct = Math.round((est / Math.max(1, info.size)) * 100);
        return (
          <div className="space-y-3">
            <InfoRow label={t("pdf.tailleActuelle")} value={formatSize(info.size)} />
            <Select
              label={t("pdf.field.level")}
              value={compression}
              onChange={(v) => setCompression(v as CompressionLevel)}
              options={[
                ["low", t("pdf.compression.low")],
                ["medium", t("pdf.compression.medium")],
                ["high", t("pdf.compression.high")],
                ["max", t("pdf.compression.max")],
              ]}
            />
            <div className="rounded-lg border border-border bg-surface p-2 text-[12px]">
              {t("pdf.estimation", {
                size: formatSize(est),
                pct: String(pct),
                gain: String(Math.max(0, 100 - pct)),
              })}
              {(compression === "high" || compression === "max") && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("pdf.compression.rasterizeWarning")}
                </p>
              )}
            </div>
          </div>
        );
      }
      case "rename":
        return (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {t("pdf.nouveauNom")}
            </label>
            <TextField value={newName} onChange={setNewName} />
          </div>
        );
      case "duplicate":
        return (
          <p className="text-[12px] text-muted-foreground">{t("pdf.uneCopieSeraCreeeDansLe")}</p>
        );
      case "share":
        return <p className="text-[12px] text-muted-foreground">{t("pdf.lePdfSeraPartage")}</p>;
      case "info":
        return (
          <ul className="space-y-1.5 text-[12px]">
            <InfoRow
              label={t("automations.summaryStep.name")}
              value={source.split("/").pop() ?? "—"}
            />
            <InfoRow label={t("pdf.emplacement")} value={source} mono />
            <InfoRow label={t("files.details.size")} value={formatSize(info.size)} />
            <InfoRow label={t("pdf.pages")} value={String(info.pageCount)} />
            <InfoRow label={t("pdf.titre")} value={info.title ?? "—"} />
            <InfoRow label={t("pdf.auteur")} value={info.author ?? "—"} />
            <InfoRow
              label={t("pdf.creeLe")}
              value={info.createdAt ? new Date(info.createdAt).toLocaleString() : "—"}
            />
            <InfoRow
              label={t("pdf.modifieLe")}
              value={info.modifiedAt ? new Date(info.modifiedAt).toLocaleString() : "—"}
            />
            <InfoRow label={t("pdf.producteur")} value={info.producer ?? "—"} />
            <InfoRow label={t("pdf.createur")} value={info.creator ?? "—"} />
            <InfoRow
              label={t("pdf.chiffre")}
              value={info.encrypted ? t("pdf.oui") : t("pdf.non")}
            />
          </ul>
        );
    }
  })();

  return (
    <>
      <BottomSheet
        open={!sourcePicker && !destPicker && !job.running && !createdPath && !createdPaths}
        onClose={onClose}
        title={title[mode]}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              {t("action.close")}
            </PrimaryButton>
            <PrimaryButton variant="ghost" onClick={() => setSourcePicker(true)}>
              Changer de PDF
            </PrimaryButton>
            {cta}
          </>
        }
      >
        {body}
      </BottomSheet>

      <FileSourcePicker
        open={sourcePicker}
        title={t("pdf.choisirUnPdf")}
        extensions={["pdf"]}
        multi={false}
        onCancel={() => {
          setSourcePicker(false);
          if (!source) onClose();
        }}
        onConfirm={(paths) => {
          setSourcePicker(false);
          if (paths[0]) setSource(paths[0]);
        }}
      />
      <DestinationPicker
        open={destPicker}
        title={t("files.archive.saveInto")}
        initial={null}
        onCancel={() => setDestPicker(false)}
        onConfirm={(d) => {
          setDestPicker(false);
          pending?.(d);
        }}
      />
      <ProgressDialog
        open={job.running}
        title={title[mode]}
        progress={job.progress}
        onCancel={job.cancel}
      />
      {confirm.dialog}
      {createdPath ? (
        <PostCreateActions
          path={createdPath}
          onClose={() => {
            setCreatedPath(null);
            onClose();
          }}
          onPathChanged={setCreatedPath}
        />
      ) : null}
      {createdPaths ? (
        <BottomSheet
          open
          onClose={() => {
            setCreatedPaths(null);
            onClose();
          }}
          title={t("pdf.filesCreatedTitle", { count: createdPaths.length })}
          footer={
            <PrimaryButton
              onClick={() => {
                setCreatedPaths(null);
                onClose();
              }}
            >
              {t("action.done")}
            </PrimaryButton>
          }
        >
          <ul className="space-y-1.5">
            {createdPaths.map((p) => (
              <li
                key={p}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2 text-[12px]"
              >
                <span className="min-w-0 flex-1 truncate">{p.split("/").pop()}</span>
                <button
                  className="rounded-md border border-border px-2 py-1 text-[11px]"
                  onClick={() => setCreatedPath(p)}
                >
                  Actions…
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      ) : null}
    </>
  );
}

/* ---------- Small helpers ---------- */

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-[12px] outline-none focus:border-primary"
      >
        {options.map(([v, lbl]) => (
          <option key={v} value={v}>
            {lbl}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-border/40 pb-1.5">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-right text-[12px] ${mono ? "break-all font-mono text-[11px]" : ""}`}>
        {value}
      </span>
    </li>
  );
}

function ReorderList({ order, setOrder }: { order: number[]; setOrder: (o: number[]) => void }) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setOrder(next);
  };
  return (
    <div className="max-h-[46vh] space-y-1.5 overflow-y-auto">
      {order.map((p, i) => (
        <div
          key={`${p}-${i}`}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIdx != null && dragIdx !== i) move(dragIdx, i);
            setDragIdx(null);
          }}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 text-[12px]"
        >
          <span className="w-6 text-center text-muted-foreground">☰</span>
          <span className="flex-1">Page originale n° {p}</span>
          <button onClick={() => move(i, i - 1)} className="px-1">
            ↑
          </button>
          <button onClick={() => move(i, i + 1)} className="px-1">
            ↓
          </button>
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   NEW TOOL SHEETS — added by the PDF audit.
   Each sheet uses the shared source/dest pickers and the useJob() hook.
   ========================================================================== */

/* ---------- Single-PDF loader helper ---------- */

function useSinglePdfPicker() {
  const t = useT();
  const [source, setSource] = useState<string | null>(null);
  const [info, setInfo] = useState<PdfInfo | null>(null);
  const [picker, setPicker] = useState(true);
  useEffect(() => {
    if (!source) return;
    pdfInfo(source)
      .then(setInfo)
      .catch((e) =>
        toast.error(errorMessage(e, t("pdf.error.openPdf")), {
          description: t("pdf.error.openPdf.desc"),
        }),
      );
  }, [source, t]);
  return { source, info, picker, setPicker, setSource };
}

/* ==========================================================================
   Annoter et signer — visual WYSIWYG sheets built on <PdfAnnotator />.
   Common flow: pick PDF → render pages → add / drag / resize / rotate
   overlays → pick destination → real save → post-create actions.
   ========================================================================== */

/* ---------- Shared bits ---------- */

function useUndoState<T>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setState((prev) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      past.current.push(prev);
      if (past.current.length > 80) past.current.shift();
      future.current = [];
      return v;
    });
  }, []);
  const undo = useCallback(() => {
    setState((prev) => {
      const p = past.current.pop();
      if (p === undefined) return prev;
      future.current.push(prev);
      return p;
    });
  }, []);
  const redo = useCallback(() => {
    setState((prev) => {
      const n = future.current.pop();
      if (n === undefined) return prev;
      past.current.push(prev);
      return n;
    });
  }, []);
  const reset = useCallback((v: T) => {
    past.current = [];
    future.current = [];
    setState(v);
  }, []);
  return {
    value: state,
    set,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

/* ---------- Watermark ---------- */

type WmScope = "all" | "odd" | "even" | "range";

function WatermarkSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { source, info, picker, setPicker, setSource } = useSinglePdfPicker();
  const [mode, setMode] = useState<"text" | "image">("text");
  const [text, setText] = useState("CONFIDENTIEL");
  const [family, setFamily] = useState<"helvetica" | "times" | "courier">("helvetica");
  const [bold, setBold] = useState(true);
  const [color, setColor] = useState("#111111");
  const [opacity, setOpacity] = useState(18);
  const [fontSize, setFontSize] = useState(60);
  const [angle, setAngle] = useState(-30);
  const [tile, setTile] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState(50); // percent
  const [scope, setScope] = useState<WmScope>("all");
  const [rangeStr, setRangeStr] = useState("");
  const [destPicker, setDestPicker] = useState(false);
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const job = useJob();

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );

  const resolvedPages = useMemo<number[] | undefined>(() => {
    if (!info) return undefined;
    if (scope === "all") return undefined;
    if (scope === "odd")
      return Array.from({ length: info.pageCount }, (_, i) => i + 1).filter((n) => n % 2 === 1);
    if (scope === "even")
      return Array.from({ length: info.pageCount }, (_, i) => i + 1).filter((n) => n % 2 === 0);
    // range: "1-3,5,8-10"
    const out = new Set<number>();
    for (const part of rangeStr.split(",")) {
      const seg = part.trim();
      if (!seg) continue;
      const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(seg);
      if (!m) continue;
      const a = Math.max(1, Math.min(info.pageCount, Number(m[1])));
      const b = m[2] ? Math.max(1, Math.min(info.pageCount, Number(m[2]))) : a;
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i);
    }
    return Array.from(out).sort((x, y) => x - y);
  }, [scope, rangeStr, info]);

  const canSave = !!source && (mode === "text" ? text.trim().length > 0 : !!imageFile);

  const run = async (d: { rootId: string; segments: string[] }) => {
    if (!source) return;
    const ctrl = job.start();
    const base = (source.split("/").pop() ?? "document.pdf").replace(/\.pdf$/i, "");
    const abs = `${toAbsolutePath({ rootId: d.rootId as never, segments: d.segments })}/${base}_filigrane.pdf`;
    try {
      const rgbHex = hexToRgb01(color);
      let imagePayload: { bytes: Uint8Array; mime: string } | undefined;
      if (mode === "image" && imageFile) {
        const buf = new Uint8Array(await imageFile.arrayBuffer());
        imagePayload = {
          bytes: buf,
          mime: imageFile.type === "image/png" ? "image/png" : "image/jpeg",
        };
      }
      const res = await watermarkPdf(
        source,
        abs,
        {
          text: mode === "text" ? text : undefined,
          image: imagePayload,
          opacity: Math.max(0.02, Math.min(1, opacity / 100)),
          fontSize: Math.max(10, fontSize),
          angle,
          color: rgbHex,
          family,
          bold,
          tile,
          pages: resolvedPages,
          imageWidth: imageWidth / 100,
        },
        { signal: ctrl.signal, onProgress: (p) => job.update(p) },
      );
      recordPdfOp({
        kind: "watermark" as never,
        summary: `Filigrane sur ${res.pageCount} page(s)`,
        sources: [source],
        outputs: [res.path],
      });
      toast.success(t("pdf.filigraneApplique"), {
        description: `Nouveau fichier de ${formatSize(res.size)}.`,
      });
      setCreatedPath(res.path);
    } catch (e) {
      if ((e as Error).name === "AbortError") toast.info(t("pdf.toast.cancelled"));
      else toast.error(errorMessage(e, t("pdf.error.generic")));
    } finally {
      job.stop();
    }
  };

  return (
    <>
      <BottomSheet
        open={!picker && !destPicker && !job.running && !createdPath}
        onClose={onClose}
        title={t("pdf.ajouterUnFiligrane")}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              {t("action.close")}
            </PrimaryButton>
            <PrimaryButton variant="ghost" onClick={() => setPicker(true)}>
              {t("action.change")}
            </PrimaryButton>
            <PrimaryButton onClick={() => setDestPicker(true)} disabled={!canSave}>
              {t("pdf.enregistrer")}
            </PrimaryButton>
          </>
        }
      >
        {!info ? (
          <p className="py-4 text-center text-[12px] text-muted-foreground">
            {t("state.analyzing")}
          </p>
        ) : (
          <div className="space-y-3">
            <InfoRow label={t("pdf.pages")} value={String(info.pageCount)} />
            <div className="flex gap-1 rounded-lg border border-border p-0.5 text-[12px]">
              <button
                type="button"
                onClick={() => setMode("text")}
                className={`flex-1 rounded-md py-1 ${mode === "text" ? "bg-primary text-primary-foreground" : ""}`}
              >
                {t("pdf.texte")}
              </button>
              <button
                type="button"
                onClick={() => setMode("image")}
                className={`flex-1 rounded-md py-1 ${mode === "image" ? "bg-primary text-primary-foreground" : ""}`}
              >
                Image
              </button>
            </div>

            {mode === "text" ? (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                    Texte
                  </label>
                  <TextField value={text} onChange={setText} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[11px] text-muted-foreground">
                    Police
                    <select
                      value={family}
                      onChange={(e) => setFamily(e.target.value as typeof family)}
                      className="mt-1 w-full rounded border border-border bg-background px-1 py-1 text-[12px] text-foreground"
                    >
                      <option value="helvetica">Helvetica</option>
                      <option value="times">Times</option>
                      <option value="courier">Courier</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-muted-foreground">
                    {t("files.details.size")}
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value) || 60)}
                      className="mt-1 w-full rounded border border-border bg-background px-1 py-1 text-[12px]"
                    />
                  </label>
                  <label className="text-[11px] text-muted-foreground">
                    Couleur
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="mt-1 h-8 w-full rounded border border-border"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={bold}
                    onChange={(e) => setBold(e.target.checked)}
                  />
                  Gras
                </label>
              </>
            ) : (
              <div>
                <input
                  ref={imgRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setImageFile(f);
                    if (imageUrl) URL.revokeObjectURL(imageUrl);
                    setImageUrl(f ? URL.createObjectURL(f) : null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => imgRef.current?.click()}
                  className="w-full rounded-xl border border-dashed border-border p-3 text-center text-[12px]"
                >
                  <ImageIcon className="mx-auto mb-1 h-5 w-5" />
                  {imageFile ? imageFile.name : t("pdf.tools.pickImage")}
                </button>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    className="mt-2 max-h-24 rounded border border-border"
                  />
                ) : null}
                <label className="mt-2 block text-[11px] text-muted-foreground">
                  Largeur ({imageWidth}% de la page)
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={imageWidth}
                    onChange={(e) => setImageWidth(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-muted-foreground">
                Opacité ({opacity}%)
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                Rotation ({angle}°)
                <input
                  type="range"
                  min={-90}
                  max={90}
                  value={angle}
                  onChange={(e) => setAngle(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={tile} onChange={(e) => setTile(e.target.checked)} />
              {t("pdf.repeterSurTouteLaPageMosaique")}
            </label>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                {t("pdf.pagesConcernees")}
              </label>
              <div className="flex gap-1 text-[11px]">
                {(["all", "odd", "even", "range"] as WmScope[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}
                    className={`flex-1 rounded border px-2 py-1 ${scope === s ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                  >
                    {s === "all"
                      ? t("pdf.wmScope.all")
                      : s === "odd"
                        ? t("pdf.wmScope.odd")
                        : s === "even"
                          ? t("pdf.wmScope.even")
                          : t("pdf.wmScope.range")}
                  </button>
                ))}
              </div>
              {scope === "range" ? (
                <div className="mt-2">
                  <TextField
                    value={rangeStr}
                    onChange={setRangeStr}
                    placeholder={t("pdf.rangeExample")}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </BottomSheet>

      <FileSourcePicker
        open={picker}
        title={t("pdf.choisirUnPdf")}
        extensions={["pdf"]}
        multi={false}
        onCancel={() => {
          setPicker(false);
          if (!source) onClose();
        }}
        onConfirm={(paths) => {
          setPicker(false);
          if (paths[0]) setSource(paths[0]);
        }}
      />
      <DestinationPicker
        open={destPicker}
        title={t("files.archive.saveInto")}
        initial={null}
        onCancel={() => setDestPicker(false)}
        onConfirm={(d) => {
          setDestPicker(false);
          run(d);
        }}
      />
      <ProgressDialog
        open={job.running}
        title={t("pdf.tool.watermark.label")}
        progress={job.progress}
        onCancel={job.cancel}
      />
      {createdPath ? (
        <PostCreateActions
          path={createdPath}
          onClose={() => {
            setCreatedPath(null);
            onClose();
          }}
          onPathChanged={setCreatedPath}
        />
      ) : null}
    </>
  );
}

/* ---------- Visual editor shell (Add Text / Image / Signature) ---------- */

function VisualEditorSheet({
  title,
  suffix,
  source,
  info,
  onChangePdf,
  onClose,
  toolbarExtras,
  elements,
  setElements,
  undo,
  redo,
  canUndo,
  canRedo,
  onCurrentPageChange,
  bodyExtra,
  suspended,
  runOp,
}: {
  title: string;
  suffix: string;
  source: string;
  info: PdfInfo;
  onChangePdf: () => void;
  onClose: () => void;
  toolbarExtras: AnnotToolbarItem[];
  elements: AnnotElement[];
  setElements: (next: AnnotElement[] | ((prev: AnnotElement[]) => AnnotElement[])) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCurrentPageChange?: (page: number) => void;
  bodyExtra?: React.ReactNode;
  suspended?: boolean;
  runOp: (
    destAbs: string,
    ctrl: AbortController,
  ) => Promise<{ path: string; size: number; pageCount: number }>;
}) {
  const t = useT();
  const [destPicker, setDestPicker] = useState(false);
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const job = useJob();
  void info;

  const run = async (d: { rootId: string; segments: string[] }) => {
    const ctrl = job.start();
    const base = (source.split("/").pop() ?? "document.pdf").replace(/\.pdf$/i, "");
    const abs = `${toAbsolutePath({ rootId: d.rootId as never, segments: d.segments })}/${base}_${suffix}.pdf`;
    try {
      const res = await runOp(abs, ctrl);
      recordPdfOp({
        kind: "rename" as never,
        summary: title,
        sources: [source],
        outputs: [res.path],
      });
      toast.success(t("pdf.modificationsEnregistrees"), {
        description: `Fichier de ${formatSize(res.size)}.`,
      });
      setCreatedPath(res.path);
    } catch (e) {
      if ((e as Error).name === "AbortError") toast.info(t("pdf.toast.cancelled"));
      else toast.error(errorMessage(e, t("pdf.error.generic")));
    } finally {
      job.stop();
    }
  };

  return (
    <>
      <BottomSheet
        open={!suspended && !destPicker && !job.running && !createdPath}
        onClose={onClose}
        title={title}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              {t("action.close")}
            </PrimaryButton>
            <PrimaryButton variant="ghost" onClick={onChangePdf}>
              Changer
            </PrimaryButton>
            <PrimaryButton onClick={() => setDestPicker(true)} disabled={elements.length === 0}>
              {t("pdf.enregistrer")}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <PdfAnnotator
            source={source}
            elements={elements}
            onChange={setElements}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            toolbar={toolbarExtras}
            onCurrentPageChange={onCurrentPageChange}
          />
          {bodyExtra}
        </div>
      </BottomSheet>
      <DestinationPicker
        open={destPicker}
        title={t("files.archive.saveInto")}
        initial={null}
        onCancel={() => setDestPicker(false)}
        onConfirm={(d) => {
          setDestPicker(false);
          run(d);
        }}
      />
      <ProgressDialog
        open={job.running}
        title={title}
        progress={job.progress}
        onCancel={job.cancel}
      />
      {createdPath ? (
        <PostCreateActions
          path={createdPath}
          onClose={() => {
            setCreatedPath(null);
            onClose();
          }}
          onPathChanged={setCreatedPath}
        />
      ) : null}
    </>
  );
}

/* ---------- Add text (visual) ---------- */

function AddTextSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { source, info, picker, setPicker, setSource } = useSinglePdfPicker();
  const undoable = useUndoState<AnnotElement[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const addText = () => {
    const el: TextElement = {
      id: newId("text"),
      kind: "text",
      page: currentPage,
      x: 0.15,
      y: 0.15,
      wFrac: 0.5,
      text: t("pdf.nouveauTexte"),
      fontSize: 18,
      color: "#111111",
      family: "helvetica",
      bold: false,
      italic: false,
      underline: false,
      align: "left",
      rotate: 0,
      opacity: 1,
    };
    undoable.set((prev) => [...prev, el]);
  };

  if (!source || !info) {
    return (
      <FileSourcePicker
        open={picker}
        title={t("pdf.choisirUnPdf")}
        extensions={["pdf"]}
        multi={false}
        onCancel={() => {
          setPicker(false);
          onClose();
        }}
        onConfirm={(paths) => {
          setPicker(false);
          if (paths[0]) setSource(paths[0]);
        }}
      />
    );
  }

  return (
    <>
      <VisualEditorSheet
        title={t("pdf.tool.addText.label")}
        suffix="texte"
        source={source}
        info={info}
        onChangePdf={() => setPicker(true)}
        onClose={onClose}
        toolbarExtras={[{ id: "add", label: t("pdf.ajouterTexte"), onClick: addText }]}
        elements={undoable.value}
        setElements={undoable.set}
        undo={undoable.undo}
        redo={undoable.redo}
        canUndo={undoable.canUndo}
        canRedo={undoable.canRedo}
        onCurrentPageChange={setCurrentPage}
        suspended={picker}
        runOp={async (abs, ctrl) => {
          const overlays: TextOverlay[] = undoable.value
            .filter((e): e is TextElement => e.kind === "text")
            .map((t) => {
              const c = hexToRgb01(t.color);
              return {
                page: t.page,
                text: t.text,
                x: t.x,
                y: t.y,
                fontSize: t.fontSize,
                color: c,
                family: t.family,
                bold: t.bold,
                italic: t.italic,
                underline: t.underline,
                rotate: t.rotate,
                opacity: t.opacity,
                align: t.align,
                maxWidth: t.wFrac,
              };
            });
          return addTextToPdf(source, abs, overlays, { signal: ctrl.signal });
        }}
      />
      <FileSourcePicker
        open={picker}
        title={t("pdf.choisirUnPdf")}
        extensions={["pdf"]}
        multi={false}
        onCancel={() => {
          setPicker(false);
        }}
        onConfirm={(paths) => {
          setPicker(false);
          if (paths[0]) {
            setSource(paths[0]);
            undoable.reset([]);
          }
        }}
      />
    </>
  );
}

/* ---------- Add image / Signer (visual) ---------- */

function AddImageSheet({ mode, onClose }: { mode: "image" | "signature"; onClose: () => void }) {
  const t = useT();
  const { source, info, picker, setPicker, setSource } = useSinglePdfPicker();
  const undoable = useUndoState<AnnotElement[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const [signatures, setSignatures] = useState<StoredSignature[]>(() => listSignatures());
  const [padOpen, setPadOpen] = useState(false);
  const [padCanvas, setPadCanvas] = useState<HTMLCanvasElement | null>(null);
  const [pickerListOpen, setPickerListOpen] = useState(false);

  const refreshSigs = () => setSignatures(listSignatures());

  const placeImagePayload = async (
    dataUrl: string,
    mime: "image/png" | "image/jpeg",
    aspect: number,
    kind: "image" | "signature",
  ) => {
    const wFrac = kind === "signature" ? 0.35 : 0.4;
    const hFrac = wFrac * (1 / aspect) * (info?.pageCount ? 1 : 1); // ratio applied when drawing
    const el: ImageElement = {
      id: newId(kind),
      kind,
      page: currentPage,
      x: 0.2,
      y: kind === "signature" ? 0.75 : 0.2,
      wFrac,
      hFrac,
      rotate: 0,
      opacity: 1,
      dataUrl,
      mime,
      aspect,
    };
    undoable.set((prev) => [...prev, el]);
  };

  const onImageFile = async (file: File | null) => {
    if (!file) return;
    const payload = await imageFileToElementPayload(file);
    await placeImagePayload(payload.dataUrl, payload.mime, payload.aspect, mode);
  };

  const savePadAsSignature = async (name: string) => {
    if (!padCanvas || isSignatureCanvasBlank(padCanvas)) {
      toast.error(t("pdf.signatureVide"), {
        description: t("pdf.dessinezVotreSignatureAvantDeL"),
      });
      return;
    }
    const dataUrl = await trimSignatureCanvas(padCanvas);
    const img = new Image();
    await new Promise((r) => {
      img.onload = r;
      img.src = dataUrl;
    });
    saveSignature(name || t("pdf.signatureDefaultName"), dataUrl);
    refreshSigs();
    setPadOpen(false);
    await placeImagePayload(
      dataUrl,
      "image/png",
      img.naturalWidth / img.naturalHeight,
      "signature",
    );
  };

  const useSavedSignature = async (s: StoredSignature) => {
    const img = new Image();
    await new Promise((r) => {
      img.onload = r;
      img.src = s.dataUrl;
    });
    setPickerListOpen(false);
    await placeImagePayload(
      s.dataUrl,
      "image/png",
      img.naturalWidth / img.naturalHeight,
      "signature",
    );
  };

  const toolbar: AnnotToolbarItem[] =
    mode === "image"
      ? [{ id: "add", label: t("pdf.ajouterImage"), onClick: () => fileInput.current?.click() }]
      : [
          { id: "draw", label: t("pdf.dessiner"), onClick: () => setPadOpen(true) },
          {
            id: "saved",
            label: t("pdf.enregistrees", { count: signatures.length }),
            onClick: () => setPickerListOpen(true),
            disabled: signatures.length === 0,
          },
          { id: "import", label: t("pdf.importer"), onClick: () => fileInput.current?.click() },
        ];

  if (!source || !info) {
    return (
      <FileSourcePicker
        open={picker}
        title={t("pdf.choisirUnPdf")}
        extensions={["pdf"]}
        multi={false}
        onCancel={() => {
          setPicker(false);
          onClose();
        }}
        onConfirm={(paths) => {
          setPicker(false);
          if (paths[0]) setSource(paths[0]);
        }}
      />
    );
  }

  return (
    <>
      <VisualEditorSheet
        title={mode === "signature" ? t("pdf.signerLePdf") : t("pdf.ajouterUneImage")}
        suffix={mode === "signature" ? "signe" : "image"}
        source={source}
        info={info}
        onChangePdf={() => setPicker(true)}
        onClose={onClose}
        toolbarExtras={toolbar}
        elements={undoable.value}
        setElements={undoable.set}
        undo={undoable.undo}
        redo={undoable.redo}
        canUndo={undoable.canUndo}
        canRedo={undoable.canRedo}
        onCurrentPageChange={setCurrentPage}
        suspended={picker || padOpen || pickerListOpen}
        bodyExtra={
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onImageFile(e.target.files?.[0] ?? null);
              e.currentTarget.value = "";
            }}
          />
        }
        runOp={async (abs, ctrl) => {
          const overlays: ImageOverlay[] = undoable.value
            .filter((e): e is ImageElement => e.kind === "image" || e.kind === "signature")
            .map((im) => ({
              page: im.page,
              bytes: dataUrlToBytes(im.dataUrl),
              mime: im.mime,
              x: im.x,
              y: im.y,
              w: im.wFrac,
              h: im.hFrac,
              opacity: im.opacity,
              rotate: im.rotate,
            }));
          return addImageToPdf(source, abs, overlays, { signal: ctrl.signal });
        }}
      />

      {padOpen ? (
        <SignatureCreateDialog
          onCancel={() => setPadOpen(false)}
          onCanvasReady={setPadCanvas}
          onSave={savePadAsSignature}
        />
      ) : null}

      {pickerListOpen ? (
        <SignatureLibraryDialog
          signatures={signatures}
          onCancel={() => setPickerListOpen(false)}
          onUse={useSavedSignature}
          onRename={(id, name) => {
            renameSignature(id, name);
            refreshSigs();
          }}
          onDelete={(id) => {
            deleteSignature(id);
            refreshSigs();
          }}
        />
      ) : null}

      <FileSourcePicker
        open={picker}
        title={t("pdf.choisirUnPdf")}
        extensions={["pdf"]}
        multi={false}
        onCancel={() => {
          setPicker(false);
        }}
        onConfirm={(paths) => {
          setPicker(false);
          if (paths[0]) {
            setSource(paths[0]);
            undoable.reset([]);
          }
        }}
      />
    </>
  );
}

function SignatureCreateDialog({
  onCancel,
  onCanvasReady,
  onSave,
}: {
  onCancel: () => void;
  onCanvasReady: (c: HTMLCanvasElement) => void;
  onSave: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const clearRef = useRef<HTMLCanvasElement | null>(null);
  return (
    <BottomSheet
      open
      onClose={onCancel}
      title={t("pdf.nouvelleSignature")}
      footer={
        <>
          <PrimaryButton variant="ghost" onClick={onCancel}>
            {t("action.cancel")}
          </PrimaryButton>
          <PrimaryButton
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSave(name);
              setBusy(false);
            }}
          >
            {t("pdf.enregistrerEtPlacer")}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-2">
        <label className="text-[11px] text-muted-foreground">
          {t("automations.summaryStep.name")}
          <TextField value={name} onChange={setName} placeholder="ex : signature perso" />
        </label>
        <SignaturePad
          onReady={(c) => {
            clearRef.current = c;
            onCanvasReady(c);
          }}
        />
        <button
          type="button"
          onClick={() => {
            const c = clearRef.current;
            if (!c) return;
            const ctx = c.getContext("2d");
            if (!ctx) return;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, c.width, c.height);
          }}
          className="text-[11px] text-muted-foreground underline"
        >
          Effacer
        </button>
      </div>
    </BottomSheet>
  );
}

function SignatureLibraryDialog({
  signatures,
  onCancel,
  onUse,
  onRename,
  onDelete,
}: {
  signatures: StoredSignature[];
  onCancel: () => void;
  onUse: (s: StoredSignature) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  return (
    <BottomSheet
      open
      onClose={onCancel}
      title={t("pdf.signature.libraryTitle")}
      footer={
        <PrimaryButton variant="ghost" onClick={onCancel}>
          {t("action.close")}
        </PrimaryButton>
      }
    >
      <div className="space-y-2">
        {signatures.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
            <img src={s.dataUrl} alt="" className="h-10 w-16 rounded bg-white object-contain" />
            <input
              defaultValue={s.name}
              onBlur={(e) => onRename(s.id, e.target.value)}
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-[12px] focus:border-border"
            />
            <button
              type="button"
              onClick={() => onUse(s)}
              className="rounded border border-primary bg-primary/10 px-2 py-1 text-[11px] text-primary"
            >
              Placer
            </button>
            <button
              type="button"
              onClick={() => onDelete(s.id)}
              className="rounded border border-destructive/40 p-1 text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

/* ---------- Fill form (interactive + free-text fallback) ---------- */

function FillFormSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { source, info, picker, setPicker, setSource } = useSinglePdfPicker();
  const [fields, setFields] = useState<FormFieldInfo[] | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [flatten, setFlatten] = useState(true);
  const [destPicker, setDestPicker] = useState(false);
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const [freeMode, setFreeMode] = useState(false);
  const undoable = useUndoState<AnnotElement[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const job = useJob();

  useEffect(() => {
    if (!source) return;
    setFields(null);
    readPdfForm(source)
      .then((f) => {
        setFields(f);
        const init: Record<string, string | boolean> = {};
        f.forEach((fd) => {
          init[fd.name] = (fd.value as string | boolean) ?? (fd.type === "checkbox" ? false : "");
        });
        setValues(init);
        setFreeMode(f.length === 0);
      })
      .catch((e) =>
        toast.error(errorMessage(e, t("pdf.impossibleDeLireCeFormulaire")), {
          description: t("pdf.lePdfNeContientPeutEtre"),
        }),
      );
  }, [source, t]);

  const addFreeText = () => {
    const el: TextElement = {
      id: newId("text"),
      kind: "text",
      page: currentPage,
      x: 0.15,
      y: 0.15,
      wFrac: 0.4,
      text: t("pdf.texte"),
      fontSize: 14,
      color: "#000000",
      family: "helvetica",
      bold: false,
      italic: false,
      underline: false,
      align: "left",
      rotate: 0,
      opacity: 1,
    };
    undoable.set((prev) => [...prev, el]);
  };

  const runInteractive = async (d: { rootId: string; segments: string[] }) => {
    if (!source) return;
    const ctrl = job.start();
    const base = (source.split("/").pop() ?? "document.pdf").replace(/\.pdf$/i, "");
    const abs = `${toAbsolutePath({ rootId: d.rootId as never, segments: d.segments })}/${base}_rempli.pdf`;
    try {
      const res = await fillPdfForm(source, abs, values, { flatten, signal: ctrl.signal });
      recordPdfOp({
        kind: "rename" as never,
        summary: t("pdf.formulaireRempli"),
        sources: [source],
        outputs: [res.path],
      });
      toast.success(t("pdf.formulaireEnregistre"), {
        description: t("pdf.lePdfRempliAEteSauvegarde"),
      });
      setCreatedPath(res.path);
    } catch (e) {
      toast.error(errorMessage(e, t("pdf.error.generic")));
    } finally {
      job.stop();
    }
  };

  // Free-text branch delegates to the visual editor sheet.
  if (source && info && freeMode) {
    return (
      <>
        <VisualEditorSheet
          title={t("pdf.remplirUnFormulaire")}
          suffix="rempli"
          source={source}
          info={info}
          onChangePdf={() => setPicker(true)}
          onClose={onClose}
          toolbarExtras={[
            { id: "add", label: t("pdf.ajouterChampTexte"), onClick: addFreeText },
            {
              id: "back",
              label: fields && fields.length ? t("pdf.champsInteractifs") : "—",
              onClick: () => setFreeMode(false),
              disabled: !(fields && fields.length),
            },
          ]}
          elements={undoable.value}
          setElements={undoable.set}
          undo={undoable.undo}
          redo={undoable.redo}
          canUndo={undoable.canUndo}
          canRedo={undoable.canRedo}
          onCurrentPageChange={setCurrentPage}
          suspended={picker}
          runOp={async (abs, ctrl) => {
            const overlays: TextOverlay[] = undoable.value
              .filter((e): e is TextElement => e.kind === "text")
              .map((t) => {
                const c = hexToRgb01(t.color);
                return {
                  page: t.page,
                  text: t.text,
                  x: t.x,
                  y: t.y,
                  fontSize: t.fontSize,
                  color: c,
                  family: t.family,
                  bold: t.bold,
                  italic: t.italic,
                  underline: t.underline,
                  rotate: t.rotate,
                  opacity: t.opacity,
                  align: t.align,
                  maxWidth: t.wFrac,
                };
              });
            return addTextToPdf(source, abs, overlays, { signal: ctrl.signal });
          }}
        />
        <FileSourcePicker
          open={picker}
          title={t("pdf.choisirUnPdf")}
          extensions={["pdf"]}
          multi={false}
          onCancel={() => {
            setPicker(false);
          }}
          onConfirm={(paths) => {
            setPicker(false);
            if (paths[0]) {
              setSource(paths[0]);
              undoable.reset([]);
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <BottomSheet
        open={!picker && !destPicker && !job.running && !createdPath}
        onClose={onClose}
        title={t("pdf.remplirUnFormulaire")}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              {t("action.close")}
            </PrimaryButton>
            <PrimaryButton variant="ghost" onClick={() => setPicker(true)}>
              {t("action.change")}
            </PrimaryButton>
            <PrimaryButton
              onClick={() => setDestPicker(true)}
              disabled={!source || !fields || fields.length === 0}
            >
              {t("pdf.enregistrer")}
            </PrimaryButton>
          </>
        }
      >
        {!fields ? (
          <p className="py-4 text-center text-[12px] text-muted-foreground">
            {t("state.analyzing")}
          </p>
        ) : fields.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              icon={ClipboardList}
              title={t("pdf.aucunChampInteractif")}
              description={t("pdf.cePdfNeContientPasDe")}
            />
            <PrimaryButton onClick={() => setFreeMode(true)}>
              {t("pdf.ajouterDuTexteLibrement")}
            </PrimaryButton>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {fields.map((f) => (
              <div key={f.name}>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  {f.name}
                </label>
                {f.type === "checkbox" ? (
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={!!values[f.name]}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))}
                    />
                    {values[f.name] ? t("pdf.coche") : t("pdf.nonCoche")}
                  </label>
                ) : f.type === "dropdown" || f.type === "radio" ? (
                  <select
                    className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-[12px]"
                    value={String(values[f.name] ?? "")}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  >
                    <option value="">—</option>
                    {(f.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TextField
                    value={String(values[f.name] ?? "")}
                    onChange={(x) => setValues((v) => ({ ...v, [f.name]: x }))}
                  />
                )}
              </div>
            ))}
            <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={flatten}
                onChange={(e) => setFlatten(e.target.checked)}
              />
              {t("pdf.verrouillerLeFormulaireApresRemplissage")}
            </label>
            <button
              type="button"
              onClick={() => setFreeMode(true)}
              className="mt-2 text-[11px] text-primary underline"
            >
              {t("pdf.ajouterAussiDuTexteLibre")}
            </button>
          </div>
        )}
      </BottomSheet>
      <FileSourcePicker
        open={picker}
        title={t("pdf.choisirUnPdf")}
        extensions={["pdf"]}
        multi={false}
        onCancel={() => {
          setPicker(false);
          if (!source) onClose();
        }}
        onConfirm={(paths) => {
          setPicker(false);
          if (paths[0]) setSource(paths[0]);
        }}
      />
      <DestinationPicker
        open={destPicker}
        title={t("files.archive.saveInto")}
        initial={null}
        onCancel={() => setDestPicker(false)}
        onConfirm={(d) => {
          setDestPicker(false);
          runInteractive(d);
        }}
      />
      <ProgressDialog
        open={job.running}
        title={t("pdf.formulaire")}
        progress={job.progress}
        onCancel={job.cancel}
      />
      {createdPath ? (
        <PostCreateActions
          path={createdPath}
          onClose={() => {
            setCreatedPath(null);
            onClose();
          }}
          onPathChanged={setCreatedPath}
        />
      ) : null}
    </>
  );
}

function PdfToImagesSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { source, info, picker, setPicker, setSource } = useSinglePdfPicker();
  const [format, setFormat] = useState<"png" | "jpeg">("jpeg");
  const [scale, setScale] = useState("2");
  const [pagesText, setPagesText] = useState("");
  const [destPicker, setDestPicker] = useState(false);
  const job = useJob();

  const parseList = (text: string, max: number): number[] =>
    Array.from(
      new Set(
        text
          .split(/[\s,]+/)
          .map((x) => parseInt(x, 10))
          .filter((n) => Number.isFinite(n) && n >= 1 && n <= max),
      ),
    ).sort((a, b) => a - b);

  const run = async (d: { rootId: string; segments: string[] }) => {
    if (!source || !info) return;
    const ctrl = job.start();
    const dir = toAbsolutePath({ rootId: d.rootId as never, segments: d.segments });
    try {
      const pages = pagesText.trim() ? parseList(pagesText, info.pageCount) : undefined;
      const res = await pdfToImages(
        source,
        dir,
        { format, scale: Math.max(1, Math.min(4, Number(scale) || 2)), pages },
        { signal: ctrl.signal, onProgress: (p) => job.update(p) },
      );
      recordPdfOp({
        kind: "extract" as never,
        summary: t("pdf.summary.imagesExported", { count: res.files.length }),
        sources: [source],
        outputs: res.files.map((f) => f.path),
      });
      toast.success(t("pdf.conversionTerminee"), {
        description: t("pdf.imagesCreated", { count: res.files.length }),
      });
      onClose();
    } catch (e) {
      if ((e as Error).name === "AbortError") toast.info(t("pdf.toast.cancelled"));
      else toast.error(errorMessage(e, t("pdf.error.generic")));
    } finally {
      job.stop();
    }
  };

  return (
    <>
      <BottomSheet
        open={!picker && !destPicker && !job.running}
        onClose={onClose}
        title={t("pdf.pdfVersImages")}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              {t("action.close")}
            </PrimaryButton>
            <PrimaryButton variant="ghost" onClick={() => setPicker(true)}>
              {t("pdf.changerDePdf")}
            </PrimaryButton>
            <PrimaryButton onClick={() => setDestPicker(true)} disabled={!source}>
              {t("pdf.enregistrer")}
            </PrimaryButton>
          </>
        }
      >
        {!info ? (
          <p className="py-4 text-center text-[12px] text-muted-foreground">
            {t("state.analyzing")}
          </p>
        ) : (
          <div className="space-y-3">
            <InfoRow label={t("pdf.pages")} value={String(info.pageCount)} />
            <div className="grid grid-cols-2 gap-2">
              <Select
                label={t("pdf.field.format")}
                value={format}
                onChange={(v) => setFormat(v as "png" | "jpeg")}
                options={[
                  ["jpeg", "JPEG"],
                  ["png", "PNG"],
                ]}
              />
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  {t("pdf.echelle14")}
                </label>
                <TextField value={scale} onChange={setScale} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                Pages (vide = toutes) — ex. 1,3,5-7
              </label>
              <TextField value={pagesText} onChange={setPagesText} />
            </div>
          </div>
        )}
      </BottomSheet>
      <FileSourcePicker
        open={picker}
        title={t("pdf.choisirUnPdf")}
        extensions={["pdf"]}
        multi={false}
        onCancel={() => {
          setPicker(false);
          if (!source) onClose();
        }}
        onConfirm={(p) => {
          setPicker(false);
          if (p[0]) setSource(p[0]);
        }}
      />
      <DestinationPicker
        open={destPicker}
        title={t("files.archive.saveInto")}
        initial={null}
        onCancel={() => setDestPicker(false)}
        onConfirm={(d) => {
          setDestPicker(false);
          run(d);
        }}
      />
      <ProgressDialog
        open={job.running}
        title={t("pdf.exportImages")}
        progress={job.progress}
        onCancel={job.cancel}
      />
    </>
  );
}

/* ---------- Extract text ---------- */

function ExtractTextSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { source, info, picker, setPicker, setSource } = useSinglePdfPicker();
  const [text, setText] = useState<string | null>(null);
  const [destPicker, setDestPicker] = useState(false);
  const job = useJob();

  useEffect(() => {
    if (!source) return;
    const ctrl = job.start();
    extractPdfText(source, { signal: ctrl.signal, onProgress: (p) => job.update(p) })
      .then((r) => setText(r.text))
      .catch((e) => toast.error(errorMessage(e, t("pdf.impossibleDExtraireLeTexte"))))
      .finally(() => job.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const run = async (d: { rootId: string; segments: string[] }) => {
    if (!source || text == null) return;
    const base = (source.split("/").pop() ?? "document.pdf").replace(/\.pdf$/i, "");
    const abs = `${toAbsolutePath({ rootId: d.rootId as never, segments: d.segments })}/${base}.txt`;
    try {
      const enc = new TextEncoder();
      const bytes = enc.encode(text);
      const { nativePlugin: np } = await import("@/lib/native/geniusfiles-native");
      const p = np();
      if (p) {
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        await p.writeFileBase64({ path: abs, data: btoa(bin), overwrite: true });
      }
      window.dispatchEvent(new CustomEvent("gf:storage-changed"));
      toast.success(t("pdf.texteEnregistre"), { description: t("pdf.leFichierTexteAEteCree") });
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, t("pdf.error.generic")));
    }
  };

  const copy = async () => {
    if (text == null) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("pdf.texteCopie"), {
        description: t("pdf.leContenuAEteCopieDans"),
      });
    } catch {
      toast.error(t("pdf.impossibleDeCopierLeTexte"), {
        description: t("pdf.reessayezOuCopiezLeManuellement"),
      });
    }
  };

  return (
    <>
      <BottomSheet
        open={!picker && !destPicker && !job.running}
        onClose={onClose}
        title={t("pdf.tool.extractText.label")}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              {t("action.close")}
            </PrimaryButton>
            <PrimaryButton variant="ghost" onClick={() => setPicker(true)}>
              {t("pdf.changerDePdf")}
            </PrimaryButton>
            <PrimaryButton variant="ghost" onClick={copy} disabled={text == null}>
              {t("assistant.message.copy")}
            </PrimaryButton>
            <PrimaryButton onClick={() => setDestPicker(true)} disabled={text == null}>
              {t("pdf.enregistrerTxt")}
            </PrimaryButton>
          </>
        }
      >
        {!info ? (
          <p className="py-4 text-center text-[12px] text-muted-foreground">
            {t("state.analyzing")}
          </p>
        ) : text == null ? (
          <p className="py-4 text-center text-[12px] text-muted-foreground">
            {t("pdf.extractionEnCours")}
          </p>
        ) : (
          <div className="space-y-2">
            <InfoRow label={t("pdf.pages")} value={String(info.pageCount)} />
            <textarea
              readOnly
              value={text}
              className="h-[45vh] w-full rounded-lg border border-border bg-surface p-2 text-[12px] font-mono"
            />
          </div>
        )}
      </BottomSheet>
      <FileSourcePicker
        open={picker}
        title={t("pdf.choisirUnPdf")}
        extensions={["pdf"]}
        multi={false}
        onCancel={() => {
          setPicker(false);
          if (!source) onClose();
        }}
        onConfirm={(p) => {
          setPicker(false);
          if (p[0]) setSource(p[0]);
        }}
      />
      <DestinationPicker
        open={destPicker}
        title={t("files.archive.saveInto")}
        initial={null}
        onCancel={() => setDestPicker(false)}
        onConfirm={(d) => {
          setDestPicker(false);
          run(d);
        }}
      />
      <ProgressDialog
        open={job.running}
        title={t("pdf.extractionTexte")}
        progress={job.progress}
        onCancel={job.cancel}
      />
    </>
  );
}

/* ---------- Search ---------- */

function SearchSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { source, info, picker, setPicker, setSource } = useSinglePdfPicker();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const job = useJob();

  const runSearch = async () => {
    if (!source || !query.trim()) return;
    const ctrl = job.start();
    try {
      const res = await searchInPdf(source, query, {
        caseSensitive,
        signal: ctrl.signal,
        onProgress: (p) => job.update(p),
      });
      setHits(res);
    } catch (e) {
      toast.error(errorMessage(e, t("pdf.impossibleDeLancerLaRecherche")));
    } finally {
      job.stop();
    }
  };

  return (
    <>
      <BottomSheet
        open={!picker && !job.running}
        onClose={onClose}
        title={t("pdf.rechercherDansLePdf")}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              {t("action.close")}
            </PrimaryButton>
            <PrimaryButton variant="ghost" onClick={() => setPicker(true)}>
              {t("pdf.changerDePdf")}
            </PrimaryButton>
            <PrimaryButton onClick={runSearch} disabled={!source || !query.trim()}>
              {t("action.search")}
            </PrimaryButton>
          </>
        }
      >
        {!info ? (
          <p className="py-4 text-center text-[12px] text-muted-foreground">
            {t("state.analyzing")}
          </p>
        ) : (
          <div className="space-y-3">
            <InfoRow label={t("pdf.pages")} value={String(info.pageCount)} />
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                {t("pdf.termeARechercher")}
              </label>
              <TextField value={query} onChange={setQuery} />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
              />
              {t("pdf.respecterLaCasse")}
            </label>
            {hits ? (
              hits.length === 0 ? (
                <p className="rounded-lg bg-surface p-3 text-center text-[12px] text-muted-foreground">
                  {t("pdf.aucunResultat")}
                </p>
              ) : (
                <div className="max-h-[40vh] space-y-1.5 overflow-y-auto">
                  <p className="text-[11px] text-muted-foreground">{hits.length} résultat(s)</p>
                  {hits.map((h, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border bg-surface p-2 text-[12px]"
                    >
                      <span className="mr-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                        p. {h.page}
                      </span>
                      {h.snippet}
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </div>
        )}
      </BottomSheet>
      <FileSourcePicker
        open={picker}
        title={t("pdf.choisirUnPdf")}
        extensions={["pdf"]}
        multi={false}
        onCancel={() => {
          setPicker(false);
          if (!source) onClose();
        }}
        onConfirm={(p) => {
          setPicker(false);
          if (p[0]) setSource(p[0]);
        }}
      />
      <ProgressDialog
        open={job.running}
        title={t("pdf.recherche")}
        progress={job.progress}
        onCancel={job.cancel}
      />
    </>
  );
}

/* ---------- Text → PDF ---------- */

function TextToPdfSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const [name, setName] = useState("document.pdf");
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [destPicker, setDestPicker] = useState(false);
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const job = useJob();

  const run = async (d: { rootId: string; segments: string[] }) => {
    const ctrl = job.start();
    const finalName = name.endsWith(".pdf") ? name : `${name}.pdf`;
    const abs = `${toAbsolutePath({ rootId: d.rootId as never, segments: d.segments })}/${finalName}`;
    try {
      const res = await textToPdf(
        text,
        abs,
        { pageSize, orientation },
        { signal: ctrl.signal, onProgress: (p) => job.update(p) },
      );
      recordPdfOp({
        kind: "images-to-pdf" as never,
        summary: t("pdf.texteVersPdf"),
        sources: [t("pdf.texteSaisi")],
        outputs: [res.path],
      });
      toast.success(t("pdf.post.title"), {
        description: t("pdf.pageSize", { count: res.pageCount, size: formatSize(res.size) }),
      });
      setCreatedPath(res.path);
    } catch (e) {
      toast.error(errorMessage(e, t("pdf.error.generic")));
    } finally {
      job.stop();
    }
  };

  return (
    <>
      <BottomSheet
        open={!destPicker && !job.running && !createdPath}
        onClose={onClose}
        title={t("pdf.creerUnPdfDepuisDuTexte")}
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              {t("action.close")}
            </PrimaryButton>
            <PrimaryButton
              onClick={() => setDestPicker(true)}
              disabled={!text.trim() || !name.trim()}
            >
              {t("pdf.enregistrer")}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("pdf.collezOuSaisissezVotreTexte")}
            className="h-[35vh] w-full rounded-lg border border-border bg-surface p-2 text-[12px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              label={t("pdf.field.format")}
              value={pageSize}
              onChange={(v) => setPageSize(v as PageSize)}
              options={[
                ["A4", "A4"],
                ["Letter", "Letter"],
                ["Legal", "Legal"],
                ["A3", "A3"],
                ["A5", "A5"],
              ]}
            />
            <Select
              label={t("pdf.field.orientation")}
              value={orientation}
              onChange={(v) => setOrientation(v as Orientation)}
              options={[
                ["portrait", t("pdf.orientation.portrait")],
                ["landscape", t("pdf.orientation.landscape")],
              ]}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              {t("pdf.nomDuFichier")}
            </label>
            <TextField value={name} onChange={setName} placeholder="document.pdf" />
          </div>
        </div>
      </BottomSheet>
      <DestinationPicker
        open={destPicker}
        title={t("files.archive.saveInto")}
        initial={null}
        onCancel={() => setDestPicker(false)}
        onConfirm={(d) => {
          setDestPicker(false);
          run(d);
        }}
      />
      <ProgressDialog
        open={job.running}
        title={t("pdf.creationPdf")}
        progress={job.progress}
        onCancel={job.cancel}
      />
      {createdPath ? (
        <PostCreateActions
          path={createdPath}
          onClose={() => {
            setCreatedPath(null);
            onClose();
          }}
          onPathChanged={setCreatedPath}
        />
      ) : null}
    </>
  );
}

/* ---------- Files → PDF (multi-format converter) ---------- */

function FilesToPdfSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [sources, setSources] = useState<string[]>([]);
  const [sourcePicker, setSourcePicker] = useState(false);
  const [destPicker, setDestPicker] = useState(false);
  const [merge, setMerge] = useState(false);
  const [baseName, setBaseName] = useState("fusion");
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const job = useJob();

  const run = async (d: { rootId: string; segments: string[] }) => {
    const ctrl = job.start();
    const dir = toAbsolutePath({ rootId: d.rootId as never, segments: d.segments });
    try {
      const res = await filesToPdf(sources, dir, {
        merge,
        baseName,
        signal: ctrl.signal,
        onProgress: (p) => job.update(p),
      });
      const ok = res.results.filter((r) => r.output && !r.error).length;
      const failed = res.results.filter((r) => r.error);
      recordPdfOp({
        kind: "images-to-pdf" as never,
        summary: `${ok} fichier(s) convertis${res.merged ? " + fusion" : ""}`,
        sources,
        outputs: [
          ...(res.merged ? [res.merged] : []),
          ...res.results.map((r) => r.output).filter((x): x is string => !!x),
        ],
      });
      if (failed.length) {
        toast.warning(
          `${ok} converti(s), ${failed.length} en échec : ${failed
            .slice(0, 3)
            .map((f) => f.error)
            .join(" · ")}`,
        );
      } else {
        toast.success(t("pdf.conversionTerminee"), {
          description: `${ok} fichier${ok > 1 ? "s" : ""} converti${ok > 1 ? "s" : ""} en PDF.`,
        });
      }
      const first = res.merged ?? res.results.find((r) => r.output)?.output;
      if (first) setCreatedPath(first);
      else onClose();
    } catch (e) {
      if ((e as Error).name === "AbortError") toast.info(t("pdf.toast.cancelled"));
      else toast.error(errorMessage(e, t("pdf.error.generic")));
    } finally {
      job.stop();
    }
  };

  return (
    <>
      <BottomSheet
        open={!sourcePicker && !destPicker && !job.running && !createdPath}
        onClose={onClose}
        title="Convertir en PDF"
        footer={
          <>
            <PrimaryButton variant="ghost" onClick={onClose}>
              {t("action.close")}
            </PrimaryButton>
            <PrimaryButton onClick={() => setDestPicker(true)} disabled={sources.length === 0}>
              Convertir…
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSourcePicker(true)}
            className="w-full rounded-xl border border-dashed border-border p-4 text-center text-[13px] hover:text-foreground"
          >
            <FilePlus2 className="mx-auto mb-1 h-5 w-5" /> Ajouter des fichiers
          </button>
          <p className="text-[11px] text-muted-foreground">
            Formats supportés : Word (.docx), Excel (.xlsx/.xls), PowerPoint (.pptx), images
            (JPG/PNG/WEBP), texte (.txt/.md/.csv), PDF.
          </p>
          {sources.length > 0 ? (
            <ul className="space-y-1">
              {sources.map((s, i) => (
                <li
                  key={s + i}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 text-[12px]"
                >
                  <span className="w-5 text-center text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{s.split("/").pop()}</span>
                  <button
                    className="px-1 text-muted-foreground"
                    onClick={() => setSources((p) => p.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} />
            {t("pdf.fusionnerTousLesResultatsDansUn")}
          </label>
          {merge ? (
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                {t("pdf.nomDuFichierFusionne")}
              </label>
              <TextField value={baseName} onChange={setBaseName} />
            </div>
          ) : null}
        </div>
      </BottomSheet>
      <FileSourcePicker
        open={sourcePicker}
        title={t("pdf.choisirDesFichiers")}
        extensions={[
          "pdf",
          "docx",
          "xlsx",
          "xls",
          "pptx",
          "txt",
          "md",
          "csv",
          "jpg",
          "jpeg",
          "png",
          "webp",
          "gif",
          "bmp",
        ]}
        multi
        onCancel={() => setSourcePicker(false)}
        onConfirm={(paths) => {
          setSourcePicker(false);
          setSources((prev) => [...prev, ...paths]);
        }}
      />
      <DestinationPicker
        open={destPicker}
        title={t("files.archive.saveInto")}
        initial={null}
        onCancel={() => setDestPicker(false)}
        onConfirm={(d) => {
          setDestPicker(false);
          run(d);
        }}
      />
      <ProgressDialog
        open={job.running}
        title={t("pdf.conversion")}
        progress={job.progress}
        onCancel={job.cancel}
      />
      {createdPath ? (
        <PostCreateActions
          path={createdPath}
          onClose={() => {
            setCreatedPath(null);
            onClose();
          }}
          onPathChanged={setCreatedPath}
        />
      ) : null}
    </>
  );
}
