import { formatDate, formatSize, kindLabel } from "@/lib/files/format";
import type { DetailsInfo } from "@/lib/files/operations";
import { FileIcon } from "./FileIcon";
import { kindOf } from "@/lib/files/format";
import { BottomSheet, PrimaryButton } from "./BottomSheet";
import { useT } from "@/lib/i18n";

export function DetailsSheet({
  open,
  info,
  onClose,
}: {
  open: boolean;
  info: DetailsInfo | null;
  onClose: () => void;
}) {
  const t = useT();
  if (!info) return null;
  const kind = kindOf(info.name, info.isDirectory);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("action.details")}
      footer={<PrimaryButton onClick={onClose}>{t("action.close")}</PrimaryButton>}
    >
      <div className="mb-3 flex items-center gap-3">
        <FileIcon kind={kind} size="lg" path={info.path} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{info.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {info.isDirectory ? kindLabel(kind) : kindLabel(kind, info.ext)}
          </p>
        </div>
      </div>
      <dl className="divide-y divide-border rounded-lg border border-border">
        <Row label={t("files.details.location")} value={info.path} mono />
        <Row label={t("files.details.size")} value={formatSize(info.size)} />
        {info.isDirectory ? (
          <Row
            label={t("files.details.content")}
            value={info.itemCount != null ? t("count.files", { count: info.itemCount }) : "—"}
          />
        ) : null}
        <Row label={t("files.details.modified")} value={formatDate(info.mtime)} />
        {info.ext ? <Row label={t("files.details.extension")} value={`.${info.ext}`} /> : null}
      </dl>
    </BottomSheet>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 px-3 py-2 text-[12px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`truncate text-foreground ${mono ? "font-mono text-[11px]" : ""}`}>{value}</dd>
    </div>
  );
}
