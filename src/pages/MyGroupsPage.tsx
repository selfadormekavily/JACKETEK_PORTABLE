import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context";
import { authUrl } from "@/features/auth/returnTo";
import { ArrowRight, PageShell, PageTitle } from "@/features/cart/components/ui";
import { groupsApi } from "@/features/groups/api";
import { GroupName, Notice, StatusPatch } from "@/features/groups/components/ui";
import { useGroupError } from "@/features/groups/errors";
import type { MyGroup } from "@/features/groups/types";
import { useDocumentTitle, useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";

/** /groups — the group orders the customer hosts or is in (and ones they left), newest activity first. */
export default function MyGroupsPage() {
  const { t, tp } = useI18n();
  const message = useGroupError();
  const auth = useAuth();
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle("meta.title.groups");

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    groupsApi.mine().then(
      (r) => setGroups(r.groups),
      (err) => setError(message(err)),
    );
  }, [auth.status, message]);

  if (auth.status === "anonymous") return <Navigate to={authUrl(ROUTES.groups)} replace />;

  const role = (g: MyGroup) =>
    g.membershipStatus === "left" ? t("group.mine.left") : g.membershipStatus === "removed" ? t("group.mine.removed") : g.role === "host" ? t("group.mine.hosting") : t("group.mine.member");

  return (
    <PageShell>
      <PageTitle eyebrow={t("group.mine.eyebrow")}>{t("group.mine.title")}</PageTitle>
      {error && (
        <div className="mt-8 max-w-[560px]">
          <Notice attention>{error}</Notice>
        </div>
      )}
      {!groups && !error && (
        <p className="jk-label mt-10 text-jk-muted" role="status">
          {t("common.loading")}
        </p>
      )}
      {groups && groups.length === 0 && (
        <div className="mt-10 max-w-[560px]">
          <p className="jk-body">{t("group.mine.empty")}</p>
          <Link to={ROUTES.cart} className="jk-btn-primary mt-8 w-full sm:w-[320px]">
            {t("group.mine.emptyCta")}
            <ArrowRight />
          </Link>
        </div>
      )}
      {groups && groups.length > 0 && (
        <ul className="mt-12 flex max-w-[860px] flex-col gap-4" aria-label={t("group.mine.listAria")}>
          {groups.map((g) => (
            <li key={g.id}>
              <Link to={`${ROUTES.groups}/${g.id}`} className="jk-group-row" data-testid="group-row">
                <span className="min-w-0">
                  <span className="jk-group-row__name block">
                    <GroupName name={g.name} />
                  </span>
                  <span className="jk-group-row__meta block">
                    {role(g)} · {tp("group.count.members", g.memberCount)} · {tp("group.count.jackets", g.jackets)}
                  </span>
                </span>
                <StatusPatch status={g.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
