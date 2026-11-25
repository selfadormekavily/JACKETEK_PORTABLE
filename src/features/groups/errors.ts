import { useCallback } from "react";
import { useI18n } from "@/i18n/useI18n";
import { GroupApiError } from "./api";

/**
 * A group error in the customer's language, from the server's stable
 * `code` (never its English text). Unknown codes get the generic message.
 */
export function useGroupError() {
  const { t, tMaybe } = useI18n();
  return useCallback(
    (err: unknown) => {
      const code = err instanceof GroupApiError ? err.code : "UNKNOWN";
      return tMaybe(`group.errors.${code}`) ?? t("group.errors.UNKNOWN");
    },
    [t, tMaybe],
  );
}
