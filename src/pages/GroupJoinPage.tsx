import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/context";
import { authUrl } from "@/features/auth/returnTo";
import { Receipt } from "@/features/cart/components/editorial";
import { ArrowRight, PageShell, PageTitle } from "@/features/cart/components/ui";
import { GroupApiError, groupsApi, isInviteToken } from "@/features/groups/api";
import { GroupName, Notice, StatusPatch } from "@/features/groups/components/ui";
import { useGroupError } from "@/features/groups/errors";
import type { InvitePreview } from "@/features/groups/types";
import { useDocumentTitle, useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";

type Load = { phase: "loading" } | { phase: "ready"; invite: InvitePreview } | { phase: "invalid" } | { phase: "error"; error: unknown };

/**
 * /join/:token — an invitation. Shows the group (name, host, how many are
 * in it) before anything else, then: log in / sign up (coming back here
 * afterwards), join, or — when the link no longer works, the group is
 * locked or cancelled, or the host removed this customer — says so plainly.
 */
export default function GroupJoinPage() {
  const { token = "" } = useParams();
  const { t, tp } = useI18n();
  const message = useGroupError();
  const auth = useAuth();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>(() => (isInviteToken(token) ? { phase: "loading" } : { phase: "invalid" }));
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  useDocumentTitle("meta.title.join");

  // Again once the session is known: a signed-in visitor learns whether they're already in.
  useEffect(() => {
    if (!isInviteToken(token) || auth.status === "loading") return;
    let live = true;
    groupsApi.invite(token).then(
      (r) => live && setLoad({ phase: "ready", invite: r.invite }),
      (err) => live && setLoad(err instanceof GroupApiError && err.code === "INVITE_INVALID" ? { phase: "invalid" } : { phase: "error", error: err }),
    );
    return () => {
      live = false;
    };
  }, [token, auth.status]);

  const join = async () => {
    setJoining(true);
    setJoinError(null);
    try {
      const r = await groupsApi.join(token);
      navigate(`${ROUTES.groups}/${r.groupId}`, { state: { notice: r.joined ? "joined" : undefined } });
    } catch (err) {
      if (err instanceof GroupApiError && err.code === "UNAUTHENTICATED") navigate(authUrl(`${ROUTES.join}/${token}`));
      else setJoinError(message(err));
      if (err instanceof GroupApiError && err.code === "INVITE_INVALID") setLoad({ phase: "invalid" });
    } finally {
      setJoining(false);
    }
  };

  if (load.phase === "loading")
    return (
      <PageShell>
        <p className="jk-label text-jk-muted" role="status">
          {t("common.loading")}
        </p>
      </PageShell>
    );

  if (load.phase === "invalid") return <Closed title={t("group.join.invalidTitle")} body={t("group.join.invalidBody")} />;
  if (load.phase === "error")
    return (
      <PageShell>
        <PageTitle eyebrow={t("group.join.eyebrow")}>{t("group.page.loadError")}</PageTitle>
        <div className="mt-8 max-w-[560px]">
          <Notice attention>{message(load.error)}</Notice>
        </div>
      </PageShell>
    );

  const { invite } = load;
  if (invite.membershipStatus === "removed") return <Closed title={t("group.join.removedTitle")} body={t("group.join.removedBody")} />;
  const member = invite.membershipStatus === "active" && invite.groupId;
  if (!member && invite.status === "CANCELLED") return <Closed title={t("group.join.cancelledTitle")} body={t("group.join.cancelledBody")} />;
  if (!member && invite.status !== "OPEN") return <Closed title={t("group.join.lockedTitle")} body={t("group.join.lockedBody")} />;

  return (
    <PageShell>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div>
          <PageTitle fit eyebrow={t("group.join.eyebrow")}>
            <GroupName name={invite.name} />
          </PageTitle>
          {invite.hostFirstName && (
            <p className="mt-5 text-[16px] text-jk-ink">{t("group.join.invitedBy", { host: "⁨" + invite.hostFirstName + "⁩" })}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <StatusPatch status={invite.status} />
            <span className="text-[14px] text-jk-ink">{tp("group.count.members", invite.memberCount)}</span>
          </div>
          <p className="jk-body mt-8 max-w-[560px]">{t("group.join.body")}</p>
        </div>

        <Receipt title={t("group.join.eyebrow")}>
          {member ? (
            <>
              <p className="text-[15px] text-jk-ink">{t("group.join.alreadyMember")}</p>
              <Link to={`${ROUTES.groups}/${invite.groupId}`} className="jk-btn-primary mt-6 w-full">
                {t("group.join.open")}
                <ArrowRight />
              </Link>
            </>
          ) : auth.status !== "authenticated" ? (
            <Link to={authUrl(`${ROUTES.join}/${token}`)} className="jk-btn-primary w-full" data-testid="join-signin">
              {t("group.join.signIn")}
              <ArrowRight />
            </Link>
          ) : (
            <>
              <button type="button" className="jk-btn-primary w-full" disabled={joining} onClick={() => void join()} data-testid="join-button">
                {joining ? t("group.join.joining") : t("group.join.join")}
                <ArrowRight />
              </button>
              {joinError && (
                <div className="mt-4">
                  <Notice attention live>
                    {joinError}
                  </Notice>
                </div>
              )}
            </>
          )}
        </Receipt>
      </div>
    </PageShell>
  );
}

function Closed({ title, body }: { title: string; body: string }) {
  const { t } = useI18n();
  return (
    <PageShell>
      <PageTitle eyebrow={t("group.join.eyebrow")}>{title}</PageTitle>
      <p className="jk-body mt-8 max-w-[560px]">{body}</p>
      <Link to={ROUTES.home} className="jk-btn-primary mt-10 w-full sm:w-[320px]">
        {t("group.join.home")}
        <ArrowRight />
      </Link>
    </PageShell>
  );
}
