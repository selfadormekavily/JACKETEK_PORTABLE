import { Link } from "react-router-dom";
import { Trans } from "@/i18n/Trans";
import { useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";
import { GroupApiError } from "../api";
import type { DesignTarget } from "../designTarget";
import { useGroupError } from "../errors";

/**
 * Above the configurator's Back / Next while designing for a group: which
 * group (and whether this is a new jacket or an edit), the way back, and
 * why the jacket can't be saved, when it can't. A version conflict offers
 * to start again from the jacket as saved (this edit's draft is dropped).
 */
export function GroupDesignBar({ target, error }: { target: Extract<DesignTarget, { kind: "group" }>; error: GroupApiError | null }) {
  const { t } = useI18n();
  const message = useGroupError();
  const name = target.groupName ?? t("group.untitled");
  const problem = error ?? (target.blockedCode ? new GroupApiError("", 409, target.blockedCode) : null);
  return (
    <>
      <p className="jk-design-target" data-testid="design-target">
        <span>
          <Trans
            k={target.itemId ? "group.designBar.editing" : "group.designBar.forGroup"}
            vars={{ group: name }}
            tags={{ group: (c) => <strong><bdi dir="auto">{c}</bdi></strong> }}
          />
        </span>
        <Link to={`${ROUTES.groups}/${target.groupId}`} className="jk-label-xs jk-link text-jk-ink">
          {t("group.designBar.back")}
        </Link>
      </p>
      {problem && (
        <p className="jk-design-target__error" role="alert">
          {message(problem)}{" "}
          {problem.code === "VERSION_CONFLICT" && (
            <button
              type="button"
              className="jk-link font-semibold"
              onClick={async () => {
                await target.session.clear();
                window.location.reload();
              }}
            >
              {t("group.designBar.reload")}
            </button>
          )}
        </p>
      )}
    </>
  );
}
