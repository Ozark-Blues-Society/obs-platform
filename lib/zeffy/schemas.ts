// Zeffy's Public API v1, as far as the site uses it (decision 0007): payments, contacts and
// campaigns. Each schema mirrors one in the spec snapshot, ZEFFY_SPEC_SNAPSHOT, field for field and
// under the spec's own names: lib/zeffy/schemas.test.ts compares them, so a schema that drifts from
// the snapshot fails the tests. When Zeffy's API changes, save a new dated snapshot next to the old
// one, point ZEFFY_SPEC_SNAPSHOT at it and fix what the test reports.
//
// The client (lib/zeffy/client.ts) checks every answer against these, so code that reads a payment
// can rely on its shape. Fields Zeffy adds later are dropped. A value the snapshot doesn't allow,
// such as a new refund_status, makes the answer fail rather than pass unchecked.
//
// Money is in cents and times are Unix timestamps in seconds, as Zeffy sends them.
import { z } from "zod";

/** The spec these schemas follow, fetched from https://api.zeffy.com/api/docs/openapi.json. */
export const ZEFFY_SPEC_SNAPSHOT = "docs/vendor/zeffy-openapi-2026-11-27.json";

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();
/** "Reserved for future key-value pairs." */
const metadata = z.record(z.string(), z.unknown());

// --- Shared parts --------------------------------------------------------------------------------

export const addressSchema = z.object({
  line1: z.string(),
  city: nullableString,
  state: nullableString,
  postal_code: nullableString,
  /** Two-letter ISO country code. */
  country: nullableString,
});

/** A custom question's answer: a string, strings (multi_select) or a boolean (checkbox). */
const questionAnswerSchema = z.object({
  question: z.string(),
  type: z.enum([
    "text",
    "single_select",
    "multi_select",
    "checkbox",
    "date",
    "email",
    "phone",
    "name",
  ]),
  answer: z.union([z.string(), z.array(z.string()), z.boolean()]),
});

// --- Payments ------------------------------------------------------------------------------------

const refundSchema = z.object({
  id: z.string(),
  object: z.literal("refund"),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(["pending", "succeeded", "failed"]),
  created: z.number(),
});

const disputeSchema = z.object({
  id: z.string(),
  object: z.literal("dispute"),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(["needs_response", "won", "lost"]),
  reason: z.string(),
  created: z.number(),
});

const paymentMethodDetailSchema = z.object({
  type: z.string(),
  brand: nullableString,
  last4: nullableString,
});

const buyerSchema = z.object({
  email: nullableString,
  first_name: nullableString,
  last_name: nullableString,
  is_corporate: z.boolean(),
  company_name: nullableString,
  address: addressSchema.nullable(),
});

const discountSchema = z.object({
  code: z.string(),
  amount: z.number(),
});

const tributeSchema = z.object({
  type: z.enum(["in_honour_of", "in_memory_of"]),
  honouree_name: nullableString,
});

/** One line of a payment: a donation, a ticket (a membership is a ticket) or an extra donation. */
const itemSchema = z.object({
  id: z.string(),
  object: z.literal("item"),
  type: z.enum(["donation", "ticket", "additional_donation"]),
  amount: z.number(),
  currency: z.string(),
  recurrence_interval: nullableString,
  /** The rate bought. On the membership form, it gives the level (lib/zeffy/level-mapping.ts). */
  rate_id: nullableString,
  rate_title: nullableString,
  parent_rate_id: nullableString,
  parent_rate_title: nullableString,
  contact_id: nullableString,
  questions: z.array(questionAnswerSchema),
  tribute: tributeSchema.nullable(),
});

/** A recurring payment's subscription, such as a membership on yearly auto-renew. */
const recurringSchema = z.object({
  is_recurring: z.boolean(),
  status: z.string(),
  interval: nullableString,
  subscription_id: nullableString,
  current_period_start: nullableNumber,
  current_period_end: nullableNumber,
});

const fundSchema = z.object({
  id: z.string(),
  object: z.literal("fund"),
  code: nullableString,
  /** Keyed by locale: EN, FR, ES. */
  name: z.record(z.string(), z.string()),
});

export const paymentSchema = z.object({
  id: z.string(),
  object: z.literal("payment"),
  created: z.number(),
  amount: z.number(),
  eligible_amount: z.number(),
  currency: z.string(),
  status: z.string(),
  /** online (paid on a Zeffy form), manual (recorded by hand, as A-1 does) or imported. */
  type: z.enum(["online", "manual", "imported"]),
  refund_status: z.enum(["none", "partial", "full"]),
  refunds: z.array(refundSchema),
  dispute: disputeSchema.nullable(),
  /** The campaign's title. */
  description: nullableString,
  /** The buyer's contact id. */
  contact: nullableString,
  payment_method: paymentMethodDetailSchema,
  buyer: buyerSchema,
  discount: discountSchema.nullable(),
  campaign_type: z.string(),
  campaign_id: z.string(),
  campaign_category: z.enum([
    "auction",
    "donation",
    "event",
    "raffle",
    "sweepstakes",
    "membership",
    "peer_to_peer",
    "shop",
    "custom",
  ]),
  parent_campaign_id: nullableString,
  team_id: nullableString,
  buyer_questions: z.array(questionAnswerSchema),
  items: z.array(itemSchema),
  occurrence_id: nullableString,
  receipt_url: nullableString,
  recurring: recurringSchema.nullable(),
  fund: fundSchema.nullable(),
  metadata,
});

// --- Contacts ------------------------------------------------------------------------------------

export const contactSchema = z.object({
  id: z.string(),
  object: z.literal("contact"),
  created: z.number(),
  updated: z.number(),
  email: nullableString,
  first_name: nullableString,
  last_name: nullableString,
  phone_number: nullableString,
  address: addressSchema.nullable(),
  donor_type: z.string(),
  total_contribution: z.number(),
  currency: z.enum(["cad", "usd"]),
  locale: nullableString,
  donation_count: z.number(),
  first_donation_date: nullableNumber,
  last_donation_date: nullableNumber,
  metadata,
});

// --- Campaigns -----------------------------------------------------------------------------------

const occurrenceSchema = z.object({
  id: z.string(),
  object: z.literal("occurrence"),
  start: z.number(),
  end: z.number(),
  start_date: z.number(),
  end_date: z.number(),
  is_archived: z.boolean(),
});

const campaignQuestionSchema = z.object({
  id: z.string(),
  object: z.literal("question"),
  label: z.string(),
  type: z.enum([
    "text",
    "single_select",
    "multi_select",
    "checkbox",
    "date",
    "email",
    "phone",
    "name",
    "address",
  ]),
  required: z.boolean(),
  /** buyer: answered once per payment; per_ticket: for each ticket. */
  scope: z.enum(["buyer", "per_ticket"]),
  rate_ids: z.array(z.string()),
  choices: z.array(z.object({ id: z.string(), label: z.string() })),
});

/** Something a campaign sells: a ticket type, or a membership level on the membership form. */
const rateSchema = z.object({
  id: z.string(),
  object: z.literal("rate"),
  title: z.string(),
  description: nullableString,
  amount: z.number(),
  currency: z.string(),
  eligible_amount: nullableNumber,
  is_pay_what_you_can: z.boolean(),
  pay_what_you_can_minimum_amount: nullableNumber,
  is_add_on: z.boolean(),
  parent_rate_id: nullableString,
  /** Capacity (null: unlimited), not the tickets left: don't show it as availability. */
  seats: nullableNumber,
  minimum_to_buy: nullableNumber,
  maximum_to_buy: z.number(),
  early_bird_close_date: nullableNumber,
});

export const campaignSchema = z.object({
  id: z.string(),
  object: z.literal("campaign"),
  created: z.number(),
  updated: z.number(),
  deleted_at: nullableNumber,
  type: z.enum(["donation_form", "ticketing"]),
  category: z.string(),
  status: z.string(),
  title: z.string(),
  description: z.string(),
  locale: z.string(),
  url: nullableString,
  banner_url: nullableString,
  logo_url: nullableString,
  target: nullableNumber,
  goal_amount: nullableNumber,
  currency: z.string(),
  volume: z.number(),
  is_archived: z.boolean(),
  creator_user_id: nullableString,
  start_date: nullableNumber,
  end_date: nullableNumber,
  occurrences: z.array(occurrenceSchema),
  /** Only GET /campaigns/{id} returns the questions and the rates. */
  questions: z.array(campaignQuestionSchema).optional(),
  rates: z.array(rateSchema).optional(),
  metadata,
});

// --- Lists and errors ----------------------------------------------------------------------------

/** A page of a list. next_cursor goes in starting_after for the next page. */
export function listSchema<Item extends z.ZodType>(item: Item) {
  return z.object({
    object: z.literal("list"),
    data: z.array(item),
    has_more: z.boolean(),
    next_cursor: nullableString,
  });
}

/** Every failing request answers with this envelope. */
export const errorSchema = z.object({
  error: z
    .object({
      type: z.enum([
        "invalid_request_error",
        "authentication_error",
        "rate_limit_error",
        "api_error",
      ]),
      code: z.string(),
      message: z.string(),
      param: nullableString.optional(),
      status: z.int().optional(),
      doc_url: z.string().optional(),
    })
    .optional(),
});

// --- Requests ------------------------------------------------------------------------------------

/** Unix timestamps in seconds, for the created[...] filters. */
const createdFilters = {
  "created[lte]": z.number().optional(),
  "created[lt]": z.number().optional(),
  "created[gte]": z.number().optional(),
  "created[gt]": z.number().optional(),
};

const cursorParams = {
  ending_before: z.string().optional(),
  starting_after: z.string().optional(),
  /** 1 to 100; Zeffy's default is 10. */
  limit: z.number().optional(),
};

/** GET /api/v1/payments's query. */
export const listPaymentsQuerySchema = z.object({
  currency: z.enum(["cad", "usd"]).optional(),
  contact: z.string().optional(),
  campaign: z.string().optional(),
  type: z.enum(["online", "manual", "imported"]).optional(),
  status: z.enum(["succeeded", "failed", "pending"]).optional(),
  ...createdFilters,
  ...cursorParams,
});

/** GET /api/v1/campaigns's query. */
export const listCampaignsQuerySchema = z.object({
  creator_user_id: z.string().optional(),
  ...createdFilters,
  ...cursorParams,
});

const createPaymentAnswerSchema = z.object({
  question_id: z.string(),
  /** A name question takes "First Last"; a checkbox takes "true". */
  answer: z.string().max(1000).optional(),
  choice_ids: z.array(z.string()).optional(),
});

/**
 * POST /api/v1/payments: records an offline payment (cash, cheque, in kind or other) on a donation
 * form (an amount) or a ticketing campaign (tickets, such as one membership rate). Zeffy finds or
 * creates the contact by the email. Defaults: payment_method cash, no tax receipt, no confirmation
 * email, dated now.
 */
export const createPaymentRequestSchema = z.object({
  campaign_id: z.string(),
  amount: z.number().optional(),
  tickets: z
    .array(
      z.object({
        rate_id: z.string(),
        quantity: z.number(),
        /** Per ticket, in cents: pay-what-you-can rates only. */
        amount: z.number().optional(),
        /** One per ticket, answering the rate's per_ticket questions. */
        attendees: z.array(z.object({ answers: z.array(createPaymentAnswerSchema) })).optional(),
      }),
    )
    .optional(),
  occurrence_id: z.string().optional(),
  extra_donation: z.number().optional(),
  /** The campaign's buyer questions. */
  answers: z.array(createPaymentAnswerSchema).optional(),
  payment_method: z.enum(["cash", "cheque", "in_kind", "other"]).optional(),
  email: z.string().optional(),
  first_name: z.string().max(255).optional(),
  last_name: z.string().max(255).optional(),
  generate_tax_receipt: z.boolean().optional(),
  send_confirmation_email: z.boolean().optional(),
  /** An ISO 8601 date or date-time, to backdate the payment. */
  payment_date: z.string().optional(),
});

/**
 * PUT /api/v1/contacts: finds the contact with this email (primary or secondary) and changes the
 * fields given, or creates one. null clears a field. The email itself is never rewritten.
 */
export const upsertContactRequestSchema = z.object({
  email: z.string(),
  first_name: z.string().max(255).nullable().optional(),
  last_name: z.string().max(255).nullable().optional(),
  phone_number: z.string().max(50).nullable().optional(),
  address: addressSchema.nullable().optional(),
});

// --- Types ---------------------------------------------------------------------------------------

export type ZeffyAddress = z.infer<typeof addressSchema>;
export type ZeffyPayment = z.infer<typeof paymentSchema>;
export type ZeffyPaymentItem = ZeffyPayment["items"][number];
export type ZeffyRecurring = NonNullable<ZeffyPayment["recurring"]>;
export type ZeffyContact = z.infer<typeof contactSchema>;
export type ZeffyCampaign = z.infer<typeof campaignSchema>;
export type ZeffyRate = NonNullable<ZeffyCampaign["rates"]>[number];
export type ZeffyOccurrence = ZeffyCampaign["occurrences"][number];
export type ZeffyCampaignQuestion = NonNullable<ZeffyCampaign["questions"]>[number];
export type ZeffyList<Item> = {
  object: "list";
  data: Item[];
  has_more: boolean;
  next_cursor: string | null;
};
export type ZeffyErrorEnvelope = z.infer<typeof errorSchema>;
export type ZeffyListPaymentsQuery = z.input<typeof listPaymentsQuerySchema>;
export type ZeffyListCampaignsQuery = z.input<typeof listCampaignsQuerySchema>;
export type ZeffyCreatePaymentRequest = z.input<typeof createPaymentRequestSchema>;
export type ZeffyUpsertContactRequest = z.input<typeof upsertContactRequestSchema>;
