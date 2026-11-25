import { useState, type FormEvent } from "react";
import { Receipt } from "@/features/cart/components/editorial";
import { Field } from "@/features/cart/components/ui";
import { useI18n } from "@/i18n/useI18n";
import { groupsApi } from "../api";
import type { GroupView } from "../types";
import { ConfirmAction } from "./ui";

/**
 * The host's controls: rename, lock / unlock, a new invite link, cancel.
 * Each is shown only when the server lists it in the viewer's permissions,
 * and sent with the revision the host is looking at (a stale page gets a
 * conflict, never a surprise). Managing people lives on each member's row.
 */
export function HostPanel({
  view,
  run,
}: {
  view: GroupView;
  /** Runs a change, then reloads the group; reports errors on the page. */
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const can = (a: GroupView["viewer"]["permissions"][number]) => view.viewer.permissions.includes(a);
  const { id, revision, name } = view.group;
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(name ?? "");

  const rename = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => groupsApi.rename(id, draftName.trim() || null))) setRenaming(false);
  };

  if (!["group.rename", "group.lock", "group.unlock", "invite.rotate", "group.cancel"].some((a) => can(a as never))) return null;

  return (
    <Receipt title={t("group.host.title")}>
      {can("group.rename") && (
        <div className="jk-host-row">
          {renaming ? (
            <form onSubmit={(e) => void rename(e)} className="flex flex-col gap-3">
              <Field label={t("group.start.nameLabel")} value={draftName} maxLength={80} dir={draftName ? "auto" : undefined} onChange={(e) => setDraftName(e.target.value)} />
              <div className="jk-confirm__buttons">
                <button type="submit" className="jk-btn-quiet">
                  {t("group.host.renameSave")}
                </button>
                <button type="button" className="jk-btn-quiet" onClick={() => setRenaming(false)}>
                  {t("group.host.keep")}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="jk-btn-quiet"
              onClick={() => {
                setDraftName(name ?? "");
                setRenaming(true);
              }}
            >
              {t("group.host.rename")}
            </button>
          )}
        </div>
      )}
      {can("group.lock") && (
        <div className="jk-host-row">
          <ConfirmAction label={t("group.host.lock")} question={t("group.host.lockConfirm")} onConfirm={async () => {
            await run(() => groupsApi.setStatus(id, "LOCKED", revision));
          }} />
          <p className="jk-host-row__hint">{t("group.host.lockHint")}</p>
        </div>
      )}
      {can("group.unlock") && (
        <div className="jk-host-row">
          <button type="button" className="jk-btn-quiet" onClick={() => void run(() => groupsApi.setStatus(id, "OPEN", revision))}>
            {t("group.host.unlock")}
          </button>
          <p className="jk-host-row__hint">{t("group.host.unlockHint")}</p>
        </div>
      )}
      {can("invite.rotate") && (
        <div className="jk-host-row">
          <ConfirmAction label={t("group.host.rotate")} question={t("group.host.rotateConfirm")} onConfirm={async () => {
            await run(() => groupsApi.rotateInvite(id));
          }} />
        </div>
      )}
      {can("group.cancel") && (
        <div className="jk-host-row">
          <ConfirmAction danger label={t("group.host.cancel")} question={t("group.host.cancelConfirm")} onConfirm={async () => {
            await run(() => groupsApi.setStatus(id, "CANCELLED", revision));
          }} />
        </div>
      )}
    </Receipt>
  );
}
