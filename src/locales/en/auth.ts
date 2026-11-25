/**
 * English source: auth (/auth — log in, create an account, the country
 * code picker). Messages the API returns live in serverErrors.
 */
const auth = {
  stage: {
    ariaSaved: "Your saved design",
    altSaved: "The jacket you designed",
    altDefault: "A JACKETEK varsity jacket",
    savedEyebrow: "Your design is saved",
    /** <accent> = the crimson second half of the headline. */
    savedHeadline: "One step <accent>to your cart.</accent>",
    savedNote: "Log in or create an account and your jacket goes straight into your cart, exactly as you designed it.",
    atelierEyebrow: "The JACKETEK atelier",
    signupHeadline: "Made for <accent>your year.</accent>",
    loginHeadline: "Welcome <accent>back.</accent>",
  },
  tabs: {
    aria: "Log in or create an account",
    logIn: "Log in",
    createAccount: "Create account",
  },
  title: {
    signup: "Create your account",
    login: "Log in to JACKETEK",
  },
  lede: {
    addingToCart: "Your jacket is waiting. It goes into your cart the moment you're in.",
    signup: "Save your designs, check out faster and follow your class order.",
    login: "Use the email or mobile number you signed up with.",
  },
  method: {
    aria: "Use email or mobile number",
    email: "Email",
    phone: "Mobile number",
  },
  fields: {
    firstName: "First name",
    lastName: "Last name",
    email: "Email address",
    emailPlaceholder: "name@example.com",
    phone: "Mobile number",
    password: "Password",
    passwordHint: {
      one: "At least {count} character. Any letters, numbers or symbols.",
      other: "At least {count} characters. Any letters, numbers or symbols.",
    },
    passwordCounter: "{n}/{min}",
    showPassword: "Show password",
    hidePassword: "Hide password",
  },
  errors: {
    firstNameRequired: "Enter your first name.",
    lastNameRequired: "Enter your last name.",
    emailInvalid: "Enter a valid email address, like name@example.com.",
    emailRequired: "Enter your email address.",
    phoneInvalid: "That number doesn't look right for the selected country.",
    phoneRequired: "Enter your mobile number.",
    passwordShort: {
      one: "Use at least {count} character.",
      other: "Use at least {count} characters.",
    },
    passwordRequired: "Enter your password.",
    network: "We couldn't reach JACKETEK. Check your connection and try again.",
  },
  submit: {
    creating: "Creating your account",
    loggingIn: "Logging in",
    createAccount: "Create account",
    logIn: "Log in",
  },
  switch: {
    haveAccount: "Already have an account?",
    newTo: "New to JACKETEK?",
    logIn: "Log in",
    createAccount: "Create an account",
  },
  country: {
    triggerAria: "Country code: {country} {dial}",
    searchAria: "Search countries",
    searchPlaceholder: "Search country or code",
    listAria: "Countries",
    /** <q> = the customer's own query (direction-isolated). */
    noMatch: "No country matches “<q>{query}</q>”.",
  },
};

export default auth;
