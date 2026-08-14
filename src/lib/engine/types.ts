/**
 * GeniusFiles — Moteur d'exécution universel.
 *
 * Ce module définit le contrat stable entre un émetteur de commandes
 * (UI, assistant IA, automatisations, tests) et l'exécuteur réel. Le
 * moteur est totalement indépendant de toute logique conversationnelle
 * ou de tout fournisseur IA : il reçoit une commande structurée, la
 * valide, l'exécute via les modules internes de GeniusFiles, puis
 * retourne un résultat exploitable.
 *
 * L'ajout d'une nouvelle opération se fait en enregistrant un nouveau
 * `CommandHandler` dans le registre — les fondations ne bougent pas.
 */
import type { FileEntry, PathRef, SortKey, SortOrder } from "@/lib/files/types";
import type { KindFilter, SizeBand, DateBand } from "@/lib/search/types";
import type { ConflictPolicy, ArchiveFormat } from "@/lib/files/archive";

/* ---------- Codes d'erreur normalisés ---------- */

export type EngineErrorCode =
  | "UNKNOWN_COMMAND"
  | "INVALID_PARAMS"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAVAILABLE"
  | "CANCELLED"
  | "EXECUTION_FAILED";

export type EngineError = {
  code: EngineErrorCode;
  message: string;
  details?: unknown;
};

/* ---------- Progression / annulation ---------- */

export type EngineProgress = {
  processed: number;
  total: number;
  bytes?: number;
  totalBytes?: number;
  currentName?: string;
  etaMs?: number;
};

export type EngineExecuteOptions = {
  onProgress?: (p: EngineProgress) => void;
  /** Signal d'annulation coopératif (compatible AbortController). */
  signal?: AbortSignal;
};

/* ---------- Paramètres par type de commande ---------- */

export type ListParams = { path: PathRef };

export type SearchParams = {
  query: string;
  roots: PathRef[];
  filters?: {
    kind?: KindFilter;
    size?: SizeBand;
    date?: DateBand;
    sizeMinBytes?: number;
    sizeMaxBytes?: number;
    mtimeMin?: number;
    mtimeMax?: number;
    /** Liste blanche d'extensions (sans le point, minuscules). */
    exts?: string[];
  };

  /** Nombre maximal de résultats retournés (défaut : illimité). */
  limit?: number;
};

export type CopyParams = {
  source: PathRef;
  entries: FileEntry[];
  destination: PathRef;
};

export type MoveParams = CopyParams;

export type RenameParams = {
  parent: PathRef;
  entry: FileEntry;
  newName: string;
};

export type DeleteParams = {
  parent: PathRef;
  entries: FileEntry[];
};

export type CreateParams = {
  parent: PathRef;
  name: string;
  /** `folder` uniquement à cette étape — les fichiers vides viendront après. */
  kind?: "folder";
};

export type CompressParams = {
  parent: PathRef;
  entries: FileEntry[];
  destination: PathRef;
  archiveName: string;
  format?: ArchiveFormat;
  level?: number;
  password?: string;
};

export type ExtractParams = {
  parent: PathRef;
  entry: FileEntry;
  destination: PathRef;
  entries?: string[];
  conflict?: ConflictPolicy;
  password?: string;
};

export type ShareParams = {
  parent: PathRef;
  entries: FileEntry[];
};

export type AnalyzeParams = {
  roots: PathRef[];
};

export type SortParams = {
  entries: FileEntry[];
  key: SortKey;
  order?: SortOrder;
  foldersFirst?: boolean;
};

export type FilterParams = {
  entries: FileEntry[];
  kind?: KindFilter;
  size?: SizeBand;
  date?: DateBand;
  nameContains?: string;
  minBytes?: number;
  maxBytes?: number;
  mtimeMin?: number;
  mtimeMax?: number;
};

export type PropertiesParams = {
  parent: PathRef;
  entry: FileEntry;
};

/* ---------- Registre des commandes ---------- */

/**
 * Discriminated union des commandes de première classe. Les gestionnaires
 * additionnels enregistrés dynamiquement utilisent la variante
 * `{ type: string; params: unknown }` — le moteur reste ouvert par
 * conception (Open/Closed).
 */
export type EngineCommand =
  | { id?: string; type: "list"; params: ListParams }
  | { id?: string; type: "search"; params: SearchParams }
  | { id?: string; type: "copy"; params: CopyParams }
  | { id?: string; type: "move"; params: MoveParams }
  | { id?: string; type: "rename"; params: RenameParams }
  | { id?: string; type: "delete"; params: DeleteParams }
  | { id?: string; type: "create"; params: CreateParams }
  | { id?: string; type: "compress"; params: CompressParams }
  | { id?: string; type: "extract"; params: ExtractParams }
  | { id?: string; type: "share"; params: ShareParams }
  | { id?: string; type: "analyze"; params: AnalyzeParams }
  | { id?: string; type: "sort"; params: SortParams }
  | { id?: string; type: "filter"; params: FilterParams }
  | { id?: string; type: "properties"; params: PropertiesParams }
  | { id?: string; type: string; params: unknown };

export type EngineResult<D = unknown> = {
  ok: boolean;
  type: string;
  commandId?: string;
  data?: D;
  error?: EngineError;
  warnings?: string[];
  durationMs: number;
  cancelled?: boolean;
};

/* ---------- Gestionnaire de commande ---------- */

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: EngineErrorCode; message: string; details?: unknown };

export interface CommandHandler<P = unknown, D = unknown> {
  /** Identifiant unique du type de commande (`"copy"`, `"custom.foo"` …). */
  readonly type: string;
  /** Validation légère synchronisée — appelée avant `run`. */
  validate?(params: P): ValidationResult;
  /** Exécute la commande. Peut lever une `EngineExecutionError`. */
  run(params: P, ctx: EngineExecuteOptions): Promise<D>;
  /**
   * Indique si la commande produit des effets de bord persistants. Utile
   * pour distinguer les opérations pures (`sort`, `filter`) des
   * opérations qui modifient réellement le stockage.
   */
  readonly sideEffect?: boolean;
}
