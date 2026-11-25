import auth from "@/locales/en/auth";
import cart from "@/locales/en/cart";
import catalog from "@/locales/en/catalog";
import checkout from "@/locales/en/checkout";
import configurator from "@/locales/en/configurator";
import group from "@/locales/en/group";
import { account, common, footer, language, meta, nav, notFound } from "@/locales/en/core";
import hero from "@/locales/en/hero";
import order from "@/locales/en/order";
import serverErrors from "@/locales/en/serverErrors";
import story from "@/locales/en/story";
import studies from "@/locales/en/studies";

/** English — the source locale. Every key is defined here first. */
const en = {
  meta,
  common,
  language,
  nav,
  account,
  footer,
  notFound,
  hero,
  story,
  studies,
  catalog,
  configurator,
  auth,
  cart,
  group,
  checkout,
  order,
  serverErrors,
};

export type EnMessages = typeof en;
export default en;
