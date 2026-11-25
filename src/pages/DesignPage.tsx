import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import Nav from "@/components/Nav";
import { useAuth } from "@/features/auth/context";
import { authUrl } from "@/features/auth/returnTo";
import { ArrowRight, PageShell, PageTitle } from "@/features/cart/components/ui";
import { ConfiguratorProvider, ConfiguratorShell } from "@/features/configurator";
import { loadDraft } from "@/features/configurator/state/draft";
import { GroupApiError, groupsApi, isGroupId } from "@/features/groups/api";
import { Notice } from "@/features/groups/components/ui";
import { DesignTargetContext, type DesignTarget } from "@/features/groups/designTarget";
import { useGroupError } from "@/features/groups/errors";
import { draftSession, editKey, newJacketKey, type Loaded as Draft } from "@/features/groups/groupDraft";
import type { GroupView, OwnGroupJacket } from "@/features/groups/types";
import { useDocumentTitle, useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";

/**
 * /design — the jacket configurator. Loaded lazily from App so the
 * (future) 3D bundle never weighs down the landing page.
 *
 * /design?group=<id> designs a new jacket for that group, and
 * /design?group=<id>&item=<id> reopens one of the customer's own group
 * jackets. Both keep their own drafts (features/groups/groupDraft.ts): the
 * personal draft and cart are untouched.
 */
export default function DesignPage() {
  useDocumentTitle("meta.title.design");
  const [params] = useSearchParams();
  const group = params.get("group");
  const item = params.get("item");

  if (isGroupId(group)) return <GroupDesign key={`${group}:${item ?? ""}`} groupId={group} itemId={isGroupId(item) ? item : undefined} />;
  return (
    <ConfiguratorProvider>
      <Stage />
    </ConfiguratorProvider>
  );
}

function Stage() {
  return (
    <>
      {/* The page's top border (design §7.1). */}
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-40 h-[6px] bg-jk-ink" />
      <Nav variant="stage" />
      <main>
        <ConfiguratorShell />
      </main>
    </>
  );
}

type Loaded = { view: GroupView; jacket: OwnGroupJacket | null };

function GroupDesign({ groupId, itemId }: { groupId: string; itemId?: string }) {
  const { t } = useI18n();
  const message = useGroupError();
  const auth = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<GroupApiError | null>(null);
  const here = `${ROUTES.design}?group=${groupId}${itemId ? `&item=${itemId}` : ""}`;

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let live = true;
    Promise.all([groupsApi.get(groupId), itemId ? groupsApi.jacket(groupId, itemId) : Promise.resolve(null)]).then(
      ([view, jacket]) => live && view && setLoaded({ view, jacket: jacket?.item ?? null }),
      (err) => live && setError(err instanceof GroupApiError ? err : new GroupApiError(String(err), 0, "UNKNOWN")),
    );
    return () => {
      live = false;
    };
  }, [auth.status, groupId, itemId]);

  // One draft per group design; for edits, tied to the version being edited.
  const session = useMemo(() => {
    if (!loaded) return null;
    const { jacket } = loaded;
    if (itemId && jacket?.config) {
      const config = jacket.config;
      return draftSession(editKey(itemId), async () => ({ config }), jacket.version);
    }
    // A new jacket starts from the personal draft (read, never written).
    return draftSession(newJacketKey(groupId), () => loadDraft());
  }, [loaded, groupId, itemId]);

  // The starting design is read BEFORE the configurator mounts, so it is in
  // place at once: nothing the customer does is overwritten by a late load.
  const [start, setStart] = useState<{ design: Draft | null } | null>(null);
  useEffect(() => {
    if (!session) return;
    let live = true;
    void session.load().then((design) => live && setStart({ design }));
    return () => {
      live = false;
    };
  }, [session]);
  const persistence = useMemo(
    () => (session && start ? { load: () => Promise.resolve(start.design), save: session.save } : null),
    [session, start],
  );

  const target = useMemo<DesignTarget | null>(() => {
    if (!loaded || !session) return null;
    const { view, jacket } = loaded;
    const perms = view.viewer.permissions;
    const blockedCode =
      jacket && jacket.status !== "active" ? "ITEM_WITHDRAWN" : !perms.includes(itemId ? "item.editOwn" : "item.create") ? "GROUP_NOT_OPEN" : null;
    return { kind: "group", groupId, groupName: view.group.name, session, itemId, baseVersion: jacket?.version, blockedCode };
  }, [loaded, session, groupId, itemId]);

  if (auth.status === "anonymous") return <Navigate to={authUrl(here)} replace />;

  if (error) {
    if (error.code === "UNAUTHENTICATED") return <Navigate to={authUrl(here)} replace />;
    return (
      <PageShell>
        <PageTitle eyebrow={t("group.page.eyebrow")}>{t("group.page.loadError")}</PageTitle>
        <div className="mt-8 max-w-[560px]">
          <Notice attention>{message(error)}</Notice>
        </div>
        <Link to={error.code === "GROUP_NOT_FOUND" ? ROUTES.groups : `${ROUTES.groups}/${groupId}`} className="jk-btn-primary mt-10 w-full sm:w-[320px]">
          {error.code === "GROUP_NOT_FOUND" ? t("group.page.allGroups") : t("group.designBar.back")}
          <ArrowRight />
        </Link>
      </PageShell>
    );
  }

  if (!target || !persistence)
    return (
      <PageShell>
        <p className="jk-label text-jk-muted" role="status">
          {t("common.loading")}
        </p>
      </PageShell>
    );

  return (
    <DesignTargetContext.Provider value={target}>
      <ConfiguratorProvider persistence={persistence}>
        <Stage />
      </ConfiguratorProvider>
    </DesignTargetContext.Provider>
  );
}
