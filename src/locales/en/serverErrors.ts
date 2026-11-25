/**
 * English source: messages the API can return to customers. The server
 * keeps answering in English; the client maps the known ones to these
 * keys (i18n/serverErrors.ts) and anything unknown to `generic`.
 */
const serverErrors = {
  generic: "Something went wrong. Please try again.",
  passwordShort: "Use at least {min} characters.",
  passwordLong: "That password is too long.",
  signupRateLimit: "Too many sign-ups from here. Try again in a few minutes.",
  firstNameRequired: "Enter your first name.",
  lastNameRequired: "Enter your last name.",
  nameTooLong: "That name is too long.",
  phoneInvalid: "Enter a valid mobile number for the selected country.",
  emailInvalid: "Enter a valid email address, like name@example.com.",
  emailInvalidShort: "Enter a valid email address.",
  checkFields: "Please check the highlighted fields.",
  emailTaken: "An account already uses this email.",
  emailTakenLogIn: "An account already uses this email. Log in instead.",
  phoneTaken: "An account already uses this number.",
  phoneTakenLogIn: "An account already uses this number. Log in instead.",
  detailsTaken: "An account already uses these details. Log in instead.",
  loginFailed: "Email/phone or password is incorrect.",
  loginRateLimitIp: "Too many attempts. Try again in a minute.",
  loginRateLimitAccount: "Too many attempts for this account. Try again in 15 minutes.",
  forbidden: "This request isn't allowed.",
  orderFullName: "Full name is required.",
  orderPhone: "A valid phone number is required.",
  orderCity: "City is required.",
  orderArea: "Area is required.",
  orderAddress: "Full address is required.",
  orderCardUnavailable: "Card payment isn't available yet. Please choose Cash on Delivery.",
  orderPaymentMethod: "Choose a payment method.",
  orderItemCount: "The order must contain 1–20 jackets.",
  orderDesignMissing: "Jacket {n}: its design is missing.",
  orderNoSize: "Jacket {n}: no size selected.",
  orderBadQuantity: "Jacket {n}: invalid quantity.",
  orderTooLarge: "This order is too large.",
};

export default serverErrors;
