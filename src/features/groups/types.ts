import type { ColourZone, FitId, HardwareFinish, JacketConfig, MaterialZone, MaterialId, SizeId } from "@/features/configurator";

/**
 * Group orders, as the server sends them (server/groups.mjs, server/
 * groupRoutes.mjs). The server decides everything — who may do what, the
 * totals, the quote; the website only shows it.
 */
export type GroupStatus = "OPEN" | "LOCKED" | "CHECKOUT" | "SUBMITTED" | "PAID" | "CANCELLED";
export type GroupRole = "host" | "member";
export type MembershipStatus = "active" | "left" | "removed";

/** What the server allows the viewer to do right now (its capability table). */
export type GroupAction =
  | "group.view"
  | "invite.view"
  | "item.create"
  | "item.editOwn"
  | "member.leave"
  | "member.remove"
  | "group.rename"
  | "invite.rotate"
  | "host.transfer"
  | "group.lock"
  | "group.unlock"
  | "group.cancel";

/** What other members see of a design: choices and visible embroidery — never uploaded artwork. */
export type VisibleDesign = {
  size: SizeId | null;
  fit: FitId | null;
  colours: Record<ColourZone, string>;
  materials: Record<MaterialZone, MaterialId>;
  buttons: HardwareFinish;
  zipper: boolean;
  embroidery: (
    | { placement: string; kind: "text"; text: string; thread: string | null }
    | {
        placement: string;
        kind: "image";
        thread: string | null;
        design: { source: "library" | "upload"; libraryTitle?: string | null; designId?: string | null; frontLetters?: { letter1: string; letter2: string; style: string } };
      }
  )[];
};

export type GroupJacket = {
  id: string;
  memberId: string;
  isYours: boolean;
  version: number;
  quantity: number;
  design: VisibleDesign;
  previewUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GroupPerson = {
  id: string;
  role: GroupRole;
  firstName: string;
  lastName: string;
  joinedAt: string;
  isYou: boolean;
};

export type GroupMember = GroupPerson & { items: GroupJacket[] };

export type GroupQuote = {
  frozen: boolean;
  currency: string;
  totalJackets: number;
  contributingMembers: number;
  unitPrice: number | null;
  subtotal: number | null;
  discountRate: number;
  discountAmount: number | null;
  total: number | null;
};

export type GroupView = {
  group: {
    id: string;
    name: string | null;
    status: GroupStatus;
    revision: number;
    createdAt: string;
    updatedAt: string;
    lockedAt: string | null;
    cancelledAt: string | null;
    invite: { path: string } | null;
  };
  viewer: { memberId: string; role: GroupRole; permissions: GroupAction[] };
  members: GroupMember[];
  /** Host only. */
  formerMembers?: (GroupPerson & { status: MembershipStatus; endedAt: string | null })[];
  totals: { members: number; jackets: number };
  quote: GroupQuote | null;
};

/** One of the viewer's own jackets (status included; `config` = the full design). */
export type OwnGroupJacket = {
  id: string;
  groupId: string;
  memberId: string;
  status: "active" | "withdrawn";
  withdrawnReason: "deleted" | "member_left" | "member_removed" | null;
  version: number;
  quantity: number;
  productId: string;
  productName: string;
  clientRequestId: string;
  previewUrl: string | null;
  createdAt: string;
  updatedAt: string;
  withdrawnAt: string | null;
  config?: JacketConfig;
};

export type InvitePreview = {
  groupId: string | null;
  name: string | null;
  status: GroupStatus;
  hostFirstName: string | null;
  memberCount: number;
  joinable: boolean;
  membershipStatus: MembershipStatus | null;
};

export type MyGroup = {
  id: string;
  name: string | null;
  status: GroupStatus;
  revision: number;
  role: GroupRole;
  membershipStatus: MembershipStatus;
  memberCount: number;
  jackets: number;
  updatedAt: string;
};

/** A jacket being sent: from the configurator or the personal cart. */
export type JacketPayload = { clientRequestId: string; config: JacketConfig; quantity: number; preview: string | null };
