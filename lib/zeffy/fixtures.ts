// Synthetic Zeffy API data for tests. Zeffy has no sandbox or test mode, so tests never call its
// API: they answer the client with these, which follow the spec snapshot field for field
// (lib/zeffy/schemas.test.ts checks every one against it). Nothing here is real: the people are
// fixture members (scripts/fixtures/members.mts) or made up, with @example.com addresses, and every
// id comes from syntheticZeffyId(). Times are fixed Unix timestamps in seconds, amounts are cents.
//
// What there is: the membership form (the four level rates of lib/zeffy/level-mapping.ts), a
// concert's ticketing campaign with two dates, a donation form; payments for each, among them a
// membership on yearly auto-renew, a refunded one, a disputed one and one recorded by hand; two
// contacts; and an error envelope for each failure the spec lists.
import {
  MEMBERSHIP_CAMPAIGN_ID,
  syntheticZeffyId as id,
  ZEFFY_LEVEL_MAPPING,
} from "./level-mapping.ts";
import type {
  ZeffyAddress,
  ZeffyCampaign,
  ZeffyContact,
  ZeffyErrorEnvelope,
  ZeffyList,
  ZeffyPayment,
  ZeffyRate,
} from "./schemas.ts";

const ADDRESS: ZeffyAddress = {
  line1: "100 Example Street",
  city: "Fayetteville",
  state: "AR",
  postal_code: "72701",
  country: "US",
};

const BOARD_PRICES = { individual: 3000, band: 5000, business: 10000, sponsor: 50000 } as const;
const LEVEL_TITLES = {
  individual: "Individual",
  band: "Band",
  business: "Business",
  sponsor: "Sponsor",
} as const;

// --- Campaigns -----------------------------------------------------------------------------------

/** One rate: a ticket type, or a level on the membership form. */
function rate(
  n: number,
  title: string,
  amount: number,
  changes: Partial<ZeffyRate> = {},
): ZeffyRate {
  return {
    id: id("rate", n),
    object: "rate",
    title,
    description: null,
    amount,
    currency: "usd",
    eligible_amount: 0,
    is_pay_what_you_can: false,
    pay_what_you_can_minimum_amount: null,
    is_add_on: false,
    parent_rate_id: null,
    seats: null,
    minimum_to_buy: null,
    maximum_to_buy: 1,
    early_bird_close_date: null,
    ...changes,
  };
}

/** The membership form, with a rate for each level at the board's prices (§1). */
export const membershipCampaign = {
  id: MEMBERSHIP_CAMPAIGN_ID,
  object: "campaign",
  created: 1790866800,
  updated: 1790866800,
  deleted_at: null,
  type: "ticketing",
  category: "membership",
  status: "active",
  title: "Become a member",
  description: "Join the Ozark Blues Society for a year. Memberships renew every year.",
  locale: "en",
  url: "https://example.com/zeffy/membership",
  banner_url: null,
  logo_url: null,
  target: null,
  goal_amount: null,
  currency: "usd",
  volume: 0,
  is_archived: false,
  creator_user_id: id("user", 1),
  start_date: null,
  end_date: null,
  occurrences: [],
  // Zeffy asks each member's name and address on the form, per ticket (per membership).
  questions: [
    {
      id: id("question", 1),
      object: "question",
      label: "Member name",
      type: "name",
      required: true,
      scope: "per_ticket",
      rate_ids: ZEFFY_LEVEL_MAPPING.map((mapping) => mapping.rateId),
      choices: [],
    },
    {
      id: id("question", 2),
      object: "question",
      label: "Member email",
      type: "email",
      required: true,
      scope: "per_ticket",
      rate_ids: ZEFFY_LEVEL_MAPPING.map((mapping) => mapping.rateId),
      choices: [],
    },
  ],
  rates: ZEFFY_LEVEL_MAPPING.map((mapping, index) =>
    rate(index + 1, LEVEL_TITLES[mapping.level], BOARD_PRICES[mapping.level]),
  ),
  metadata: {},
} satisfies ZeffyCampaign;

/** A concert on two nights, Central Time, with general admission and limited VIP seats. */
export const ticketingCampaign = {
  id: id("campaign", 2),
  object: "campaign",
  created: 1795195800,
  updated: 1795370400,
  deleted_at: null,
  type: "ticketing",
  category: "event",
  status: "active",
  title: "Winter Blues Weekend",
  description: "Two nights of Ozarks blues.",
  locale: "en",
  url: "https://example.com/zeffy/winter-blues-weekend",
  banner_url: null,
  logo_url: null,
  target: null,
  goal_amount: null,
  currency: "usd",
  volume: 4000,
  is_archived: false,
  creator_user_id: id("user", 1),
  start_date: 1800147600,
  end_date: 1800248400,
  occurrences: [
    {
      id: id("occurrence", 1),
      object: "occurrence",
      start: 1800147600,
      end: 1800162000,
      start_date: 1800147600,
      end_date: 1800162000,
      is_archived: false,
    },
    {
      id: id("occurrence", 2),
      object: "occurrence",
      start: 1800234000,
      end: 1800248400,
      start_date: 1800234000,
      end_date: 1800248400,
      is_archived: false,
    },
  ],
  questions: [
    {
      id: id("question", 3),
      object: "question",
      label: "How did you hear about us?",
      type: "single_select",
      required: false,
      scope: "buyer",
      rate_ids: [],
      choices: [
        { id: id("choice", 1), label: "A friend" },
        { id: id("choice", 2), label: "The newsletter" },
      ],
    },
  ],
  rates: [
    rate(5, "General admission", 2000, { maximum_to_buy: 10 }),
    rate(6, "VIP", 4500, { description: "Front tables", seats: 40, maximum_to_buy: 4 }),
  ],
  metadata: {},
} satisfies ZeffyCampaign;

/** The donation form (P-6): no rates, the donor picks the amount. */
export const donationCampaign = {
  id: id("campaign", 3),
  object: "campaign",
  created: 1748790000,
  updated: 1772467200,
  deleted_at: null,
  type: "donation_form",
  category: "donation",
  status: "active",
  title: "Support the blues",
  description: "Gifts keep live blues in the Ozarks.",
  locale: "en",
  url: "https://example.com/zeffy/donate",
  banner_url: null,
  logo_url: null,
  target: 500000,
  goal_amount: 500000,
  currency: "usd",
  volume: 12500,
  is_archived: false,
  creator_user_id: null,
  start_date: null,
  end_date: null,
  occurrences: [],
  questions: [],
  rates: [],
  metadata: {},
} satisfies ZeffyCampaign;

/** As GET /campaigns lists a campaign: without its questions and rates. */
export function listedCampaign({ questions, rates, ...campaign }: ZeffyCampaign): ZeffyCampaign {
  void questions;
  void rates;
  return campaign;
}

// --- Payments ------------------------------------------------------------------------------------

/** A payment on the membership form for one level's rate, paid online by card. */
function membershipPayment(
  n: number,
  level: keyof typeof BOARD_PRICES,
  buyer: { first: string; last: string; email: string },
  created: number,
  changes: Partial<ZeffyPayment> = {},
): ZeffyPayment {
  const mapping = ZEFFY_LEVEL_MAPPING.find((candidate) => candidate.level === level);
  if (!mapping) throw new Error(`No rate for ${level}`);
  const amount = BOARD_PRICES[level];
  return {
    id: id("payment", n),
    object: "payment",
    created,
    amount,
    eligible_amount: 0,
    currency: "usd",
    status: "succeeded",
    type: "online",
    refund_status: "none",
    refunds: [],
    dispute: null,
    description: membershipCampaign.title,
    contact: id("contact", n),
    payment_method: { type: "card", brand: "visa", last4: "4242" },
    buyer: {
      email: buyer.email,
      first_name: buyer.first,
      last_name: buyer.last,
      is_corporate: false,
      company_name: null,
      address: ADDRESS,
    },
    discount: null,
    campaign_type: "ticketing",
    campaign_id: mapping.campaignId,
    campaign_category: "membership",
    parent_campaign_id: null,
    team_id: null,
    buyer_questions: [],
    items: [
      {
        id: id("item", n),
        object: "item",
        type: "ticket",
        amount,
        currency: "usd",
        recurrence_interval: null,
        rate_id: mapping.rateId,
        rate_title: LEVEL_TITLES[level],
        parent_rate_id: null,
        parent_rate_title: null,
        contact_id: id("contact", n),
        questions: [
          { question: "Member name", type: "name", answer: `${buyer.first} ${buyer.last}` },
          { question: "Member email", type: "email", answer: buyer.email },
        ],
        tribute: null,
      },
    ],
    occurrence_id: null,
    receipt_url: `https://example.com/zeffy/receipts/${n}`,
    recurring: null,
    fund: null,
    metadata: {},
    ...changes,
  };
}

const jesse = { first: "Jesse", last: "Carter", email: "jesse.carter@example.com" };

/** An Individual membership on yearly auto-renew: the subscription's period runs a year. */
export const recurringMembershipPayment: ZeffyPayment = (() => {
  const payment = membershipPayment(1, "individual", jesse, 1795195800);
  payment.items[0].recurrence_interval = "yearly";
  return {
    ...payment,
    recurring: {
      is_recurring: true,
      status: "active",
      interval: "yearly",
      subscription_id: id("subscription", 1),
      current_period_start: 1795195800,
      current_period_end: 1826731800,
    },
  };
})();

/** A Band membership, refunded in full two days later. */
export const refundedMembershipPayment = membershipPayment(
  2,
  "band",
  { first: "Marcus", last: "Lane", email: "marcus.lane@example.com" },
  1794326400,
  {
    refund_status: "full",
    refunds: [
      {
        id: id("refund", 1),
        object: "refund",
        amount: BOARD_PRICES.band,
        currency: "usd",
        status: "succeeded",
        created: 1794499200,
      },
    ],
  },
);

/** A Business membership whose card payment was disputed, and the Society lost the dispute. */
export const disputedMembershipPayment = membershipPayment(
  3,
  "business",
  { first: "Victor", last: "Nash", email: "victor.nash@example.com" },
  1792072800,
  {
    dispute: {
      id: id("dispute", 1),
      object: "dispute",
      amount: BOARD_PRICES.business,
      currency: "usd",
      status: "lost",
      reason: "fraudulent",
      created: 1793880000,
    },
  },
);

/** A Sponsor membership paid by cheque and recorded by hand (A-1 records these through the API). */
export const offlineMembershipPayment = membershipPayment(
  4,
  "sponsor",
  { first: "Curtis", last: "Bell", email: "curtis.bell@example.com" },
  1795618800,
  {
    type: "manual",
    payment_method: { type: "cheque", brand: null, last4: null },
    receipt_url: null,
  },
);

const sam = { first: "Sam", last: "Rivera", email: "sam.rivera@example.com" };

/** Two general admission tickets for the first night, with a discount code. */
export const ticketPayment: ZeffyPayment = {
  ...membershipPayment(5, "individual", sam, 1795551300),
  amount: 3600,
  description: ticketingCampaign.title,
  contact: id("contact", 5),
  discount: { code: "SYNTHETIC10", amount: 400 },
  campaign_id: ticketingCampaign.id,
  campaign_category: "event",
  buyer_questions: [
    { question: "How did you hear about us?", type: "single_select", answer: "A friend" },
  ],
  items: [1, 2].map((ticket) => ({
    id: id("item", 50 + ticket),
    object: "item",
    type: "ticket",
    amount: 1800,
    currency: "usd",
    recurrence_interval: null,
    rate_id: ticketingCampaign.rates[0].id,
    rate_title: ticketingCampaign.rates[0].title,
    parent_rate_id: null,
    parent_rate_title: null,
    contact_id: id("contact", 5),
    questions: [],
    tribute: null,
  })),
  occurrence_id: ticketingCampaign.occurrences[0].id,
};

/** A one-time gift in memory of someone, from someone who isn't a member. */
export const donationPayment: ZeffyPayment = {
  ...membershipPayment(6, "individual", sam, 1795370400),
  amount: 2500,
  eligible_amount: 2500,
  description: donationCampaign.title,
  contact: id("contact", 5),
  campaign_type: "donation_form",
  campaign_id: donationCampaign.id,
  campaign_category: "donation",
  items: [
    {
      id: id("item", 60),
      object: "item",
      type: "donation",
      amount: 2500,
      currency: "usd",
      recurrence_interval: null,
      rate_id: null,
      rate_title: null,
      parent_rate_id: null,
      parent_rate_title: null,
      contact_id: null,
      questions: [],
      tribute: { type: "in_memory_of", honouree_name: "A synthetic honouree" },
    },
  ],
  fund: { id: id("fund", 1), object: "fund", code: "GENERAL", name: { EN: "General fund" } },
};

// --- Contacts ------------------------------------------------------------------------------------

/** The member who bought recurringMembershipPayment. */
export const memberContact = {
  id: id("contact", 1),
  object: "contact",
  created: 1772467200,
  updated: 1795195800,
  email: jesse.email,
  first_name: jesse.first,
  last_name: jesse.last,
  phone_number: "+14795550106",
  address: ADDRESS,
  donor_type: "individual",
  total_contribution: BOARD_PRICES.individual,
  currency: "usd",
  locale: "en",
  donation_count: 1,
  first_donation_date: 1795195800,
  last_donation_date: 1795195800,
  metadata: {},
} satisfies ZeffyContact;

/** A donor and ticket buyer who isn't a member. */
export const donorContact = {
  ...memberContact,
  id: id("contact", 5),
  email: sam.email,
  first_name: sam.first,
  last_name: sam.last,
  phone_number: null,
  address: null,
  total_contribution: 6100,
  donation_count: 2,
  first_donation_date: 1795370400,
  last_donation_date: 1795551300,
} satisfies ZeffyContact;

// --- Lists and errors ----------------------------------------------------------------------------

/** One page of a list: more come after it when nextCursor isn't null. */
export function zeffyList<Item>(data: Item[], nextCursor: string | null = null): ZeffyList<Item> {
  return { object: "list", data, has_more: nextCursor !== null, next_cursor: nextCursor };
}

type ErrorBody = NonNullable<ZeffyErrorEnvelope["error"]> & { status: number };

function envelope(error: Omit<ErrorBody, "doc_url">): { error: ErrorBody } {
  return { error: { ...error, doc_url: "https://api.zeffy.com/api/docs" } };
}

/** Zeffy's answer to each failure its spec lists, with the HTTP status in error.status. */
export const zeffyErrors = {
  invalidParameters: envelope({
    type: "invalid_request_error",
    code: "invalid_parameters",
    message: "limit must be between 1 and 100.",
    param: "limit",
    status: 400,
  }),
  invalidApiKey: envelope({
    type: "authentication_error",
    code: "invalid_api_key",
    message: "The bearer token is not a valid API key.",
    param: null,
    status: 401,
  }),
  organizationNotVerified: envelope({
    type: "invalid_request_error",
    code: "organization_not_verified",
    message: "The organization must complete its Stripe verification before it can write.",
    param: null,
    status: 403,
  }),
  resourceNotFound: envelope({
    type: "invalid_request_error",
    code: "resource_not_found",
    message: `No payment found with id '${id("payment", 99)}'.`,
    param: "id",
    status: 404,
  }),
  emailAlreadyUsed: envelope({
    type: "invalid_request_error",
    code: "email_already_used",
    // Zeffy's messages can repeat what was sent, an address among them.
    message: "Another write reached jesse.carter@example.com first.",
    param: "email",
    status: 409,
  }),
  missingRequiredAnswers: envelope({
    type: "invalid_request_error",
    code: "missing_required_answers",
    message: `Required question '${id("question", 1)}' (name) has no answer.`,
    param: "tickets",
    status: 422,
  }),
  rateLimitExceeded: envelope({
    type: "rate_limit_error",
    code: "rate_limit_exceeded",
    message: "Too many requests.",
    param: null,
    status: 429,
  }),
  internalError: envelope({
    type: "api_error",
    code: "internal_error",
    message: "Something went wrong on our side.",
    param: null,
    status: 500,
  }),
} satisfies Record<string, ZeffyErrorEnvelope>;
