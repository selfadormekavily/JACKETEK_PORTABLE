import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context";
import { authUrl } from "@/features/auth/returnTo";
import { useCart } from "@/features/cart/context";
import { savePendingAdd } from "@/features/cart/pendingAdd";
import { GroupApiError, groupsApi } from "@/features/groups/api";
import { useDesignTarget } from "@/features/groups/designTarget";
import { ROUTES } from "@/lib/routes";
import { getConfigIssues } from "../model/config";
import { useConfigurator } from "../state/context";
import { takeSnapshot } from "../viewer/snapshot";

/**
 * Add to cart: the complete design (deep-copied by the cart) plus a still
 * of it. Signed in: straight into the cart. Signed out: the jacket waits
 * (cart/pendingAdd.ts) while the customer logs in or signs up, and the
 * auth page adds it to the cart and continues to /cart.
 *
 * Designing for a group (features/groups/designTarget.ts) the same button
 * adds the jacket to the group — or, editing one's own group jacket, saves
 * it over the version it was opened from. Signed out, the design stays in
 * its group draft and the customer comes back to this page after logging in.
 */
export function useAddToCart() {
  const { state } = useConfigurator();
  const { config } = state;
  const auth = useAuth();
  const cart = useCart();
  const target = useDesignTarget();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<GroupApiError | null>(null);
  const issues = getConfigIssues(config);

  const addToCart = async () => {
    if (issues.length > 0 || checking) return;
    const item = { config: structuredClone(config), preview: takeSnapshot() };
    let user = auth.user;
    if (auth.status === "loading") {
      setChecking(true);
      user = await auth.refresh();
      setChecking(false);
    }
    if (user) {
      cart.add(item);
      navigate(ROUTES.cart);
      return;
    }
    setChecking(true);
    await savePendingAdd(item);
    setChecking(false);
    navigate(authUrl(ROUTES.cart, "add-to-cart"));
  };

  const saveToGroup = async () => {
    if (target.kind !== "group" || issues.length > 0 || checking || target.blockedCode) return;
    setChecking(true);
    setError(null);
    try {
      const design = structuredClone(config);
      const preview = takeSnapshot();
      // Keep the design (and its request id) in the group draft before anything goes out.
      if (target.itemId) await target.session.save(design, state.ui.step);
      const requestId = target.itemId ? null : await target.session.requestId(design, state.ui.step);
      const user = auth.status === "loading" ? await auth.refresh() : auth.user;
      if (!user) {
        navigate(authUrl(`${location.pathname}${location.search}`));
        return;
      }
      if (target.itemId && target.baseVersion !== undefined) {
        await groupsApi.replaceJacket(target.groupId, target.itemId, { config: design, preview, expectedVersion: target.baseVersion });
      } else {
        await groupsApi.addJacket(target.groupId, { clientRequestId: requestId!, config: design, quantity: 1, preview });
      }
      await target.session.clear();
      navigate(`${ROUTES.groups}/${target.groupId}`, { state: { notice: target.itemId ? "saved" : "added" } });
    } catch (err) {
      if (err instanceof GroupApiError && err.status === 401) {
        navigate(authUrl(`${location.pathname}${location.search}`));
        return;
      }
      setError(err instanceof GroupApiError ? err : new GroupApiError(String(err), 0, "UNKNOWN"));
    } finally {
      setChecking(false);
    }
  };

  return { addToCart: target.kind === "group" ? saveToGroup : addToCart, checking, issues, error, target };
}
