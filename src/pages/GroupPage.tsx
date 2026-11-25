import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { authUrl } from "@/features/auth/returnTo";
import { PatchChip, ProductStage, Receipt } from "@/features/cart/components/editorial";
import { ArrowRight, PageShell, PageTitle } from "@/features/cart/components/ui";
import { useCart } from "@/features/cart/context";
import { groupsApi, isGroupId } from "@/features/groups/api";
import { GroupJacketCard } from "@/features/groups/components/GroupJacketCard";
import { HostPanel } from "@/features/groups/components/HostPanel";
import { InvitePanel } from "@/features/groups/components/InvitePanel";
import { ConfirmAction, GroupName, Notice, StatusPatch } from "@/features/groups/components/ui";
import { useGroupError } from "@/features/groups/errors";
import type { GroupMember, GroupView, OwnGroupJacket } from "@/features/groups/types";
import { useGroup } from "@/features/groups/useGroup";
import { formatNumber } from "@/i18n/format";
import Ltr from "@/i18n/Ltr";
import { useDocumentTitle, useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";

type NoticeKey = "added" | "saved" | "joined" | "created" | "imported";
const NOTICES: readonly NoticeKey[] = ["added", "saved", "joined", "created", "imported"];

/**
 * /groups/:groupId — one group order. Everyone sees the members and their
 * jackets (stills, sizes, quantities, visible details); the viewer's own
 * jackets come first and carry the crimson stitch and their controls. The
 * host also gets the group's controls and manages people from their rows.
 * Every action follows the server's answer (permissions, conflicts), and
 * the page keeps itself current while it is open.
 */
export default function GroupPage() {
  const { groupId = "" } = useParams();
  useDocumentTitle("meta.title.group");
  if (!isGroupId(groupId)) return <GroupMissing />;
  return <Group key={groupId} groupId={groupId} />;
}

function Group({ groupId }: { groupId: string }) {
  const { t, tp } = useI18n();
  const message = useGroupError();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, refresh } = useGroup(groupId);
  const [actionError, setActionError] = useState<string | null>(null);

  // A notice handed over by the page that sent the customer here (added, saved, joined…), shown once.
  const [notice] = useState<NoticeKey | null>(() => {
    const n = (location.state as { notice?: string } | null)?.notice;
    return NOTICES.includes(n as NoticeKey) ? (n as NoticeKey) : null;
  });
  useEffect(() => {
    if (notice) navigate(location.pathname, { replace: true, state: null });
  }, [notice, navigate, location.pathname]);

  /** A change from this page: run it, report a refusal in the customer's words, then show the server's state. */
  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setActionError(message(err));
      return false;
    } finally {
      await refresh();
    }
  };

  if (state.phase === "loading")
    return (
      <PageShell>
        <p className="jk-label text-jk-muted" role="status">
          {t("common.loading")}
        </p>
      </PageShell>
    );

  if (state.phase === "error") {
    const { code } = state.error;
    if (code === "UNAUTHENTICATED") return <Navigate to={authUrl(`${ROUTES.groups}/${groupId}`)} replace />;
    if (code === "MEMBERSHIP_ENDED") return <MembershipEnded groupId={groupId} status={(state.error.details.membershipStatus as string) ?? "left"} />;
    if (code === "GROUP_NOT_FOUND") return <GroupMissing />;
    return (
      <PageShell>
        <PageTitle eyebrow={t("group.page.eyebrow")}>{t("group.page.loadError")}</PageTitle>
        <div className="mt-8 max-w-[560px]">
          <Notice attention>{message(state.error)}</Notice>
          <button type="button" className="jk-btn-primary mt-8 w-full sm:w-[320px]" onClick={() => void refresh()}>
            {t("group.page.retry")}
            <ArrowRight />
          </button>
        </div>
      </PageShell>
    );
  }

  const { view, stale } = state;
  const { group, viewer } = view;
  const can = (a: GroupView["viewer"]["permissions"][number]) => viewer.permissions.includes(a);
  const host = view.members.find((m) => m.role === "host");
  const me = view.members.find((m) => m.isYou);
  const others = view.members.filter((m) => !m.isYou);
  const displayName = group.name ?? t("group.untitled");

  return (
    <PageShell>
      <div className="flex flex-col gap-3">
        {notice && (
          <Notice live>{t(`group.page.notice.${notice}`)}</Notice>
        )}
        {stale && <Notice attention live>{t("group.page.stale")}</Notice>}
        {actionError && (
          <Notice attention live>
            {actionError}
          </Notice>
        )}
      </div>

      <header className="mt-6">
        <PageTitle fit eyebrow={t("group.page.eyebrow")}>
          <GroupName name={group.name} />
        </PageTitle>
        {host && (
          <p className="mt-4 text-[15px] text-jk-ink">
            {t("group.page.hostedBy", { name: "⁨" + `${host.firstName} ${host.lastName}` + "⁩" })}
          </p>
        )}
        <dl className="jk-group-facts">
          <div className="jk-group-fact">
            <dt className="jk-label-xs text-jk-muted">{t("group.page.members")}</dt>
            <dd className="jk-group-fact__value" data-testid="member-count">{formatNumber(view.totals.members)}</dd>
          </div>
          <div className="jk-group-fact">
            <dt className="jk-label-xs text-jk-muted">{t("group.page.jackets")}</dt>
            <dd className="jk-group-fact__value" data-testid="jacket-count">{formatNumber(view.totals.jackets)}</dd>
          </div>
          <div className="jk-group-fact">
            <dt className="jk-label-xs text-jk-muted">{t("group.page.status")}</dt>
            <dd>
              <StatusPatch status={group.status} />
            </dd>
          </div>
        </dl>
      </header>

      {group.status === "LOCKED" && (
        <div className="mt-8 max-w-[760px]">
          <Notice attention>{t("group.page.lockedNote")}</Notice>
        </div>
      )}
      {group.status === "CANCELLED" && (
        <div className="mt-8 max-w-[760px]">
          <Notice attention>{t("group.page.cancelledNote")}</Notice>
        </div>
      )}

      {/* Phones: the invite right under the header (the side column comes last there). */}
      {group.invite && (
        <div className="mt-10 lg:hidden">
          <InvitePanel path={group.invite.path} groupName={displayName} />
        </div>
      )}

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {me && (
            <MemberSection member={me} groupId={groupId} editable={can("item.editOwn")} canManage={false} view={view} run={run} onChanged={refresh} />
          )}
          {can("item.create") && (
            <Link to={`${ROUTES.design}?group=${groupId}`} className="jk-btn-primary mt-6 w-full sm:w-[320px]" data-testid="add-jacket">
              {t("group.page.add")}
              <ArrowRight />
            </Link>
          )}
          <div className="mt-14">
            {others.map((m) => (
              <MemberSection key={m.id} member={m} groupId={groupId} editable={false} canManage={viewer.role === "host"} view={view} run={run} onChanged={refresh} />
            ))}
          </div>
          {view.formerMembers && view.formerMembers.length > 0 && (
            <section className="mt-14" aria-labelledby="jk-former">
              <h2 id="jk-former" className="jk-label text-jk-ink">
                {t("group.host.former")}
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {view.formerMembers.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 text-[14px] text-jk-ink">
                    <bdi dir="auto">
                      {m.firstName} {m.lastName}
                    </bdi>
                    <span className="jk-tag">{m.status === "removed" ? t("group.host.removed") : t("group.host.left")}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="jk-group-aside lg:sticky lg:top-[108px] lg:self-start">
          {group.invite && (
            <div className="max-lg:hidden">
              <InvitePanel path={group.invite.path} groupName={displayName} />
            </div>
          )}
          <Receipt title={t("group.page.pricingTitle")}>
            <p className="text-[14px] leading-[1.5] text-jk-ink">{tp("group.count.jackets", view.totals.jackets)}</p>
            <p className="jk-receipt__note">{t("group.page.pricingBody")}</p>
          </Receipt>
          <HostPanel view={view} run={run} />
          {can("member.leave") && (
            <div>
              <ConfirmAction
                danger
                label={t("group.page.leave")}
                question={t("group.page.leaveConfirm")}
                onConfirm={async () => {
                  if (await run(() => groupsApi.leave(groupId))) navigate(ROUTES.groups);
                }}
              />
            </div>
          )}
          <Link to={ROUTES.groups} className="jk-label jk-link inline-flex min-h-11 items-center self-start text-jk-ink">
            {t("group.page.allGroups")}
          </Link>
        </aside>
      </div>
    </PageShell>
  );
}

function MemberSection({
  member,
  groupId,
  editable,
  canManage,
  view,
  run,
  onChanged,
}: {
  member: GroupMember;
  groupId: string;
  editable: boolean;
  canManage: boolean;
  view: GroupView;
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
  onChanged: () => void;
}) {
  const { t, tp } = useI18n();
  const name = `${member.firstName} ${member.lastName}`;
  const jackets = member.items.reduce((n, i) => n + i.quantity, 0);
  const can = (a: GroupView["viewer"]["permissions"][number]) => view.viewer.permissions.includes(a);
  return (
    <section className="jk-member" aria-label={name} data-testid={member.isYou ? "my-section" : "member-section"}>
      <div className="jk-member__head">
        <h2 className="jk-member__name">
          <bdi dir="auto">{name}</bdi>
        </h2>
        {member.role === "host" && <span className="jk-tag">{t("group.role.host")}</span>}
        {member.isYou && <span className="jk-tag jk-tag--you">{t("group.role.you")}</span>}
        <span className="jk-member__count">{tp("group.count.jackets", jackets)}</span>
      </div>
      {canManage && member.role !== "host" && (can("member.remove") || can("host.transfer")) && (
        <div className="jk-member__manage">
          {can("host.transfer") && (
            <ConfirmAction
              className="jk-label jk-link min-h-11 text-jk-ink"
              label={t("group.host.makeHost")}
              question={t("group.host.makeHostConfirm", { name })}
              onConfirm={async () => {
                await run(() => groupsApi.transferHost(groupId, member.id, view.group.revision));
              }}
            />
          )}
          {can("member.remove") && (
            <ConfirmAction
              danger
              className="jk-label jk-link min-h-11 text-jk-muted hover:text-jk-accent"
              label={t("group.host.remove")}
              question={t("group.host.removeConfirm", { name })}
              onConfirm={async () => {
                await run(() => groupsApi.removeMember(groupId, member.id, view.group.revision));
              }}
            />
          )}
        </div>
      )}
      {member.items.length === 0 ? (
        <p className="jk-member__empty">{member.isYou ? t("group.page.noJacketsYou") : t("group.page.noJacketsMember")}</p>
      ) : (
        <div className="jk-member__jackets">
          {member.items.map((jacket) => (
            <GroupJacketCard key={`${jacket.id}-${jacket.version}`} jacket={jacket} groupId={groupId} ownerName={member.firstName} editable={editable} onChanged={onChanged} />
          ))}
        </div>
      )}
    </section>
  );
}

function GroupMissing() {
  const { t } = useI18n();
  return (
    <PageShell>
      <PageTitle eyebrow={t("group.page.eyebrow")}>{t("group.page.notFoundTitle")}</PageTitle>
      <p className="jk-body mt-8 max-w-[560px]">{t("group.page.notFoundBody")}</p>
      <Link to={ROUTES.groups} className="jk-btn-primary mt-10 w-full sm:w-[320px]">
        {t("group.page.allGroups")}
        <ArrowRight />
      </Link>
    </PageShell>
  );
}

/** Left or removed: the group is closed to them, but their own designs are still theirs to copy. */
function MembershipEnded({ groupId, status }: { groupId: string; status: string }) {
  const { t } = useI18n();
  const message = useGroupError();
  const cart = useCart();
  const [items, setItems] = useState<OwnGroupJacket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<Set<string>>(new Set());

  useEffect(() => {
    groupsApi.myJackets(groupId).then(
      (r) => setItems(r.items),
      (err) => setError(message(err)),
    );
  }, [groupId, message]);

  const copy = async (item: OwnGroupJacket) => {
    if (!item.config) return;
    cart.add({ config: item.config, preview: item.previewUrl ? await previewDataUrl(item.previewUrl) : null });
    setCopied((s) => new Set(s).add(item.id));
  };

  return (
    <PageShell>
      <PageTitle eyebrow={t("group.page.eyebrow")}>{status === "removed" ? t("group.page.removedTitle") : t("group.page.leftTitle")}</PageTitle>
      {items && items.length > 0 && <p className="jk-body mt-8 max-w-[620px]">{t("group.page.endedBody")}</p>}
      {error && (
        <div className="mt-6 max-w-[620px]">
          <Notice attention>{error}</Notice>
        </div>
      )}
      {items && items.length === 0 && <p className="jk-body mt-8">{t("group.page.noOwnDesigns")}</p>}
      {items && items.length > 0 && (
        <ul className="mt-10 grid max-w-[760px] gap-5">
          {items.map((item) => (
            <li key={item.id} className="jk-gjacket">
              <ProductStage src={item.previewUrl} className="jk-gjacket__stage" alt={t("group.jacket.previewAltYours")} />
              <div className="jk-gjacket__body">
                <div className="jk-gjacket__chips">
                  {item.config?.size && (
                    <PatchChip strong>
                      <Ltr>{item.config.size}</Ltr>
                    </PatchChip>
                  )}
                  <PatchChip>{t("group.jacket.quantity", { quantity: item.quantity })}</PatchChip>
                  <PatchChip>{item.status === "active" ? t("group.jacket.active") : t(`group.jacket.withdrawn.${item.withdrawnReason ?? "deleted"}`)}</PatchChip>
                </div>
                <div className="jk-gjacket__actions">
                  {copied.has(item.id) ? (
                    <p className="text-[14px] text-jk-ink" role="status">
                      {t("group.page.copied")}
                    </p>
                  ) : (
                    <button type="button" className="jk-btn-quiet" onClick={() => void copy(item)}>
                      {t("group.page.copyToCart")}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link to={ROUTES.groups} className="jk-label jk-link mt-10 inline-block text-jk-ink">
        {t("group.page.allGroups")}
      </Link>
    </PageShell>
  );
}

/** The jacket's still as a data URL, for the personal cart (which keeps its images on this device). */
async function previewDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url, { credentials: "same-origin" })).blob();
    return await new Promise((ok) => {
      const reader = new FileReader();
      reader.onload = () => ok(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => ok(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

