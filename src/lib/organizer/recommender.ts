/**
 * Transforme un `OrgReport` en `OrgRecommendation` (titre lisible +
 * explication + plan concret). Trie par pertinence : les régressions
 * apparaissent en tête.
 */
import { formatSize } from "@/lib/files/format";
import type { FileEntry, PathRef } from "@/lib/files/types";
import { classify, categoryOf } from "./classifier";
import { proposeBatchRename } from "./renamer";
import type { OrgAction, OrgIssue, OrgPlan, OrgRecommendation, OrgReport } from "./types";
import { t } from "@/lib/i18n";

let planCounter = 0;
function makePlan(
  title: string,
  description: string,
  actions: OrgAction[],
  destructive: boolean,
): OrgPlan {
  return {
    id: `plan_${Date.now()}_${++planCounter}`,
    title,
    description,
    actions,
    destructive,
  };
}

function severityRank(s: OrgIssue["severity"]): number {
  return s === "danger" ? 0 : s === "warn" ? 1 : 2;
}

function groupByCategory(
  entries: FileEntry[],
  parent: PathRef,
): Map<string, { catLabel: string; toFolder: string[]; items: FileEntry[] }> {
  const out = new Map<string, { catLabel: string; toFolder: string[]; items: FileEntry[] }>();
  for (const e of entries) {
    const cat = classify(e, parent);
    const info = categoryOf(cat);
    const bucket = out.get(cat) ?? {
      catLabel: info.label,
      toFolder: info.suggestedFolder,
      items: [],
    };
    bucket.items.push(e);
    out.set(cat, bucket);
  }
  return out;
}

export function buildRecommendations(report: OrgReport): OrgRecommendation[] {
  const recs: OrgRecommendation[] = [];
  const sorted = report.issues
    .slice()
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  for (const issue of sorted) {
    switch (issue.kind) {
      case "messy_folder": {
        if (!issue.entries || issue.entries.length === 0) break;
        const groups = groupByCategory(issue.entries, issue.path);
        const actions: OrgAction[] = [];
        for (const [catId, g] of groups) {
          if (g.items.length < 2) continue;
          actions.push({
            kind: "group",
            parent: issue.path,
            folderName: g.catLabel,
            entryNames: g.items.map((i) => i.name),
            reason: t("organize.action.groupReason", {
              count: g.items.length,
              catId,
              catLabel: g.catLabel,
            }),
          });
        }
        if (actions.length === 0) break;
        recs.push({
          id: `rec_${issue.id}`,
          severity: issue.severity,
          title: t("organize.rec.messyTitle", { folder: issue.label }),
          why: t("organize.rec.messyWhy", { detail: issue.detail }),
          cta: t("organize.rec.cta.preview"),
          plan: makePlan(
            t("organize.rec.messyPlanTitle", { folder: issue.label }),
            t("organize.rec.messyPlanDesc"),
            actions,
            true,
          ),
          issueId: issue.id,
        });
        break;
      }
      case "overloaded_folder": {
        recs.push({
          id: `rec_${issue.id}`,
          severity: issue.severity,
          title: t("organize.rec.overloadedTitle", { folder: issue.label }),
          why: t("organize.rec.overloadedWhy", { detail: issue.detail }),
          cta: t("organize.rec.cta.openFolder"),
          plan: makePlan(
            t("organize.overloaded.planTitle", { folder: issue.label }),
            t("organize.rec.overloadedPlanDesc"),
            [],
            false,
          ),
          issueId: issue.id,
        });
        break;
      }
      case "misplaced_file": {
        if (!issue.entries || issue.entries.length === 0) break;
        const groups = groupByCategory(issue.entries, issue.path);
        const actions: OrgAction[] = [];
        for (const [, g] of groups) {
          actions.push({
            kind: "move",
            from: issue.path,
            entryName: g.items[0].name,
            toParent: { rootId: issue.path.rootId, segments: g.toFolder },
            createParent: true,
            reason: t("organize.action.moveReason", { category: g.catLabel }),
          });
          // Un exemple par catégorie ; l'utilisateur pourra étendre au dossier entier.
        }
        recs.push({
          id: `rec_${issue.id}`,
          severity: issue.severity,
          title: t("organize.rec.misplacedTitle", { folder: issue.label }),
          why: t("organize.rec.misplacedWhy", { detail: issue.detail }),
          cta: t("organize.rec.cta.preview"),
          plan: makePlan(
            t("organize.rec.misplacedPlanTitle", { count: issue.entries.length }),
            t("organize.rec.misplacedPlanDesc"),
            actions,
            true,
          ),
          issueId: issue.id,
        });
        break;
      }
      case "unclear_name": {
        if (!issue.entries || issue.entries.length === 0) break;
        const proposals = proposeBatchRename(
          issue.entries.map((e) => ({ entry: e, parent: issue.path })),
        );
        if (proposals.length === 0) break;
        const actions: OrgAction[] = proposals.map((p) => ({
          kind: "rename",
          parent: p.parent,
          from: p.entryName,
          to: p.proposed,
          reason: p.reason,
        }));
        recs.push({
          id: `rec_${issue.id}`,
          severity: issue.severity,
          title: t("organize.rec.unclearTitle", { count: proposals.length }),
          why: t("organize.rec.unclearWhy", { detail: issue.detail }),
          cta: t("organize.rec.cta.renamePreview"),
          plan: makePlan(
            t("organize.rename.planTitle"),
            t("organize.rec.unclearPlanDesc"),
            actions,
            true,
          ),
          issueId: issue.id,
        });
        break;
      }
      case "isolated_files": {
        if (!issue.entries || issue.entries.length === 0) break;
        const cat = classify(issue.entries[0], issue.path);
        const info = categoryOf(cat);
        recs.push({
          id: `rec_${issue.id}`,
          severity: issue.severity,
          title: t("organize.rec.isolatedTitle", {
            count: issue.entries.length,
            category: info.label,
          }),
          why: t("organize.rec.isolatedWhy", { detail: issue.detail }),
          cta: t("organize.rec.cta.preview"),
          plan: makePlan(
            t("organize.rec.isolatedPlanTitle", { category: info.label }),
            t("organize.rec.isolatedPlanDesc"),
            [
              {
                kind: "group",
                parent: issue.path,
                folderName: info.label,
                entryNames: issue.entries.map((e) => e.name),
                reason: t("organize.action.isolatedReason", {
                  count: issue.entries.length,
                  category: info.label,
                }),
              },
            ],
            true,
          ),
          issueId: issue.id,
        });
        break;
      }
      case "hard_to_browse":
        recs.push({
          id: `rec_${issue.id}`,
          severity: issue.severity,
          title: t("organize.rec.hardTitle"),
          why: t("organize.rec.hardWhy", { detail: issue.detail }),
          cta: t("organize.rec.cta.priorities"),
          plan: makePlan(
            t("organize.rec.hardPlanTitle"),
            t("organize.rec.hardPlanDesc"),
            [],
            false,
          ),
          issueId: issue.id,
        });
        break;
    }
  }

  // Reco « transversale » : distribution + espace réorganisable
  if (report.reorganizableBytes > 0) {
    recs.unshift({
      id: `rec_summary`,
      severity: "info",
      title: t("organize.rec.summaryTitle", { size: formatSize(report.reorganizableBytes) }),
      why: t("organize.rec.summaryWhy"),
      cta: t("organize.rec.cta.seeRecs"),
      plan: makePlan(
        t("organize.rec.summaryPlanTitle"),
        t("organize.rec.summaryPlanDesc"),
        [],
        false,
      ),
    });
  }

  return recs;
}
