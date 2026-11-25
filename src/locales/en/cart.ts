/** English source: cart (the cart page and the pieces checkout/confirmation share). */
const cart = {
  title: "Your cart",
  eyebrow: {
    empty: "Cart",
    count: { one: "{count} jacket", other: "{count} jackets" },
  },
  empty: {
    body: "Your cart is empty. Design your graduation jacket and it will wait for you here.",
    cta: "Design your jacket",
  },
  itemsAria: "Jackets in your cart",
  more: {
    question: "Designing for someone else too?",
    continue: "Continue designing",
  },
  summary: {
    title: "Order summary",
    codNote: "Pay cash on delivery when you check out.",
    checkout: "Proceed to checkout",
    /** One jacket in a summary: size (an LTR island) and quantity. */
    line: "Size <size>{size}</size> · Qty {quantity}",
  },
  item: {
    aria: "{productName}, size {size}",
    ariaNoSize: "{productName}, size not selected",
    madeToOrder: "Made to order",
    size: "Size <size>{size}</size>",
    sizeNotSelected: "Size not selected",
    zoneValue: "{colour} · {material}",
    embroidery: "Embroidery: {value}",
    embroideryCustomised: "Customised",
    embroideryNone: "None",
    quantityAria: "Quantity of {productName}",
    remove: "Remove",
    number: "No. {nn}",
    imageAlt: "Your jacket design",
    emptyStage: "Your design",
  },
  trio: {
    aria: "Colours",
  },
  stepper: {
    decrease: "Decrease quantity",
    increase: "Increase quantity",
  },
  price: {
    subtotal: "Subtotal",
    delivery: "Delivery",
    total: "Total",
    tbc: "To be confirmed",
  },
  progress: {
    aria: "Checkout progress",
    cart: "Cart",
    details: "Details",
    confirmation: "Confirmation",
  },
};

export default cart;
