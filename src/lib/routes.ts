/** Central route paths, so links never hard-code URLs. */
export const ROUTES = {
  home: "/",
  design: "/design",
  cart: "/cart",
  checkout: "/checkout",
  /** Log in / create an account: /auth?returnTo=/cart&intent=add-to-cart */
  auth: "/auth",
  /** Confirmation for a placed order: /order/:orderId */
  order: "/order",
  /** Group orders: /groups (mine), /groups/:groupId (one group). */
  groups: "/groups",
  /** An invitation to a group: /join/:token */
  join: "/join",
  /** Protected order admin (not linked from the customer site). */
  admin: "/admin",
  /** The admin dashboard: all orders; /admin/orders/:orderId for one. */
  adminOrders: "/admin/orders",
} as const;
