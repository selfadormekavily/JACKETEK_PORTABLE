import type { Messages } from "@/i18n/types";
import auth from "@/locales/ar-IQ/auth";
import cart from "@/locales/ar-IQ/cart";
import catalog from "@/locales/ar-IQ/catalog";
import checkout from "@/locales/ar-IQ/checkout";
import configurator from "@/locales/ar-IQ/configurator";
import group from "@/locales/ar-IQ/group";
import { account, common, footer, language, meta, nav, notFound } from "@/locales/ar-IQ/core";
import hero from "@/locales/ar-IQ/hero";
import order from "@/locales/ar-IQ/order";
import serverErrors from "@/locales/ar-IQ/serverErrors";
import story from "@/locales/ar-IQ/story";
import studies from "@/locales/ar-IQ/studies";
import type { EnMessages } from "@/locales/en";

/**
 * Iraqi Arabic (ar-IQ). Transcreated, not translated: Iraqi voice on
 * headlines, empty states and guidance; clear, direct Arabic on errors,
 * auth, payment, delivery and checkout. Must cover every English key.
 */
const arIQ: Messages<EnMessages> = {
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

export default arIQ;
