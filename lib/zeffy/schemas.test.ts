// @vitest-environment node
// lib/zeffy/schemas.ts against the spec snapshot it follows. Both sides are reduced to the same
// shape (each field, whether it's required, null, its type, its allowed values and length) and
// compared, for every schema the client reads or sends and for the list queries. Then every
// fixture must pass its schema with nothing left over, which makes it a valid snapshot object too.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as fixtures from "./fixtures";
import {
  addressSchema,
  campaignSchema,
  contactSchema,
  createPaymentRequestSchema,
  errorSchema,
  listCampaignsQuerySchema,
  listPaymentsQuerySchema,
  listSchema,
  paymentSchema,
  upsertContactRequestSchema,
  ZEFFY_SPEC_SNAPSHOT,
} from "./schemas";

type JsonSchema = { [key: string]: unknown };

/** What both sides can say about a value. */
type Shape =
  | { type: "string"; values?: unknown[]; maxLength?: unknown }
  | { type: "number" | "integer" | "boolean" | "anything" }
  | { type: "array"; items: Shape }
  | { type: "object"; fields: Record<string, { required: boolean; shape: Shape }> }
  | { type: "map"; values: Shape }
  | { type: "union"; options: Shape[] }
  | { type: "nullable"; shape: Shape };

const spec = JSON.parse(
  readFileSync(new URL(`../../${ZEFFY_SPEC_SNAPSHOT}`, import.meta.url), "utf8"),
) as {
  paths: Record<string, Record<string, { parameters: (JsonSchema & { name: string })[] }>>;
  components: { schemas: Record<string, JsonSchema> };
};

const byJson = (a: Shape, b: Shape) => JSON.stringify(a).localeCompare(JSON.stringify(b));

function plainShape(schema: JsonSchema, convert: (schema: JsonSchema) => Shape): Shape {
  switch (schema.type) {
    case "string": {
      const values = schema.enum ?? (schema.const === undefined ? undefined : [schema.const]);
      return {
        type: "string",
        ...(Array.isArray(values) && { values: [...values].sort() }),
        ...(schema.maxLength !== undefined && { maxLength: schema.maxLength }),
      };
    }
    case "number":
    case "integer":
    case "boolean":
      return { type: schema.type };
    case "array":
      return { type: "array", items: convert(schema.items as JsonSchema) };
    case "object": {
      if (schema.properties) {
        const required = new Set(schema.required as string[] | undefined);
        const fields = Object.entries(schema.properties as Record<string, JsonSchema>).map(
          ([name, field]) => [name, { required: required.has(name), shape: convert(field) }],
        );
        return { type: "object", fields: Object.fromEntries(fields) };
      }
      const values = schema.additionalProperties as JsonSchema | undefined;
      return {
        type: "map",
        values: values && Object.keys(values).length > 0 ? convert(values) : { type: "anything" },
      };
    }
    default:
      throw new Error(`No shape for ${JSON.stringify(schema)}`);
  }
}

/** A snapshot schema: OpenAPI 3.1 written with 3.0's `nullable`, $ref and one-item allOf. */
function specShape(schema: JsonSchema): Shape {
  if (typeof schema.$ref === "string") {
    return specShape(spec.components.schemas[schema.$ref.replace("#/components/schemas/", "")]);
  }
  let shape: Shape;
  const options = (schema.oneOf ?? schema.anyOf) as JsonSchema[] | undefined;
  if (Array.isArray(schema.allOf)) {
    expect(schema.allOf).toHaveLength(1);
    shape = specShape(schema.allOf[0] as JsonSchema);
  } else if (options) {
    shape = { type: "union", options: options.map(specShape).sort(byJson) };
  } else {
    shape = plainShape(schema, specShape);
  }
  return schema.nullable === true ? { type: "nullable", shape } : shape;
}

/** A zod schema, through zod's JSON Schema: null as a type, const for literals. */
function zodShape(schema: z.ZodType, io: "input" | "output"): Shape {
  const convert = (json: JsonSchema): Shape => {
    if (Array.isArray(json.anyOf)) {
      const options = (json.anyOf as JsonSchema[]).filter((option) => option.type !== "null");
      const shape: Shape =
        options.length === 1
          ? convert(options[0])
          : { type: "union", options: options.map(convert).sort(byJson) };
      return options.length < json.anyOf.length ? { type: "nullable", shape } : shape;
    }
    if (Array.isArray(json.type)) {
      const types = json.type.filter((type) => type !== "null");
      expect(types).toHaveLength(1);
      const shape = convert({ ...json, type: types[0] });
      return types.length < json.type.length ? { type: "nullable", shape } : shape;
    }
    return plainShape(json, convert);
  };
  return convert(z.toJSONSchema(schema, { io, reused: "inline" }) as JsonSchema);
}

const response = (schema: z.ZodType) => zodShape(schema, "output");
const request = (schema: z.ZodType) => zodShape(schema, "input");
const component = (name: string) => specShape(spec.components.schemas[name]);

/** An operation's query parameters as an object. */
function queryShape(path: string): Shape {
  const parameters = spec.paths[path].get.parameters.filter(
    (parameter) => parameter.in === "query",
  );
  const fields = parameters.map((parameter) => [
    parameter.name,
    { required: parameter.required === true, shape: specShape(parameter.schema as JsonSchema) },
  ]);
  return { type: "object", fields: Object.fromEntries(fields) };
}

describe("the schemas follow the spec snapshot", () => {
  it.each([
    ["Payment", paymentSchema],
    ["Contact", contactSchema],
    ["Campaign", campaignSchema],
    ["Address", addressSchema],
    ["PaymentList", listSchema(paymentSchema)],
    ["CampaignList", listSchema(campaignSchema)],
    ["Error", errorSchema],
  ])("answers: %s", (name, schema) => {
    expect(response(schema)).toEqual(component(name));
  });

  it.each([
    ["CreatePaymentRequest", createPaymentRequestSchema],
    ["UpsertContactRequest", upsertContactRequestSchema],
  ])("requests: %s", (name, schema) => {
    expect(request(schema)).toEqual(component(name));
  });

  it.each([
    ["/api/v1/payments", listPaymentsQuerySchema],
    ["/api/v1/campaigns", listCampaignsQuerySchema],
  ])("queries: GET %s", (path, schema) => {
    expect(request(schema)).toEqual(queryShape(path));
  });

  // The comparison itself must notice a difference, or the tests above prove nothing.
  it.each([
    ["a missing field", paymentSchema.omit({ fund: true })],
    ["an extra field", paymentSchema.extend({ tip: z.number() })],
    ["a field that can't be null", paymentSchema.extend({ description: z.string() })],
    ["a field that can be null", paymentSchema.extend({ amount: z.number().nullable() })],
    ["another type", paymentSchema.extend({ created: z.string() })],
    ["fewer allowed values", paymentSchema.extend({ refund_status: z.enum(["none", "full"]) })],
    ["an optional field", paymentSchema.extend({ receipt_url: z.string().nullable().optional() })],
    ["a nested difference", paymentSchema.extend({ buyer: z.object({ email: z.string() }) })],
  ])("notices %s", (_case, schema) => {
    expect(response(schema)).not.toEqual(component("Payment"));
  });

  it("notices a required field, a length and a query parameter that differ", () => {
    expect(request(upsertContactRequestSchema.partial())).not.toEqual(
      component("UpsertContactRequest"),
    );
    expect(
      request(upsertContactRequestSchema.extend({ first_name: z.string().nullable().optional() })),
    ).not.toEqual(component("UpsertContactRequest"));
    expect(
      request(listPaymentsQuerySchema.extend({ campaign_type: z.string().optional() })),
    ).not.toEqual(queryShape("/api/v1/payments"));
  });
});

describe("the fixtures follow the schemas, with nothing left over", () => {
  const { zeffyErrors, zeffyList, listedCampaign, ...resources } = fixtures;
  const schemaFor = (fixture: { object: string }) =>
    ({ payment: paymentSchema, contact: contactSchema, campaign: campaignSchema })[fixture.object];

  it.each(Object.entries(resources))("%s", (_name, fixture) => {
    const schema = schemaFor(fixture as { object: string });
    expect(schema).toBeDefined();
    expect(schema!.parse(fixture)).toStrictEqual(fixture);
  });

  it.each(Object.entries(zeffyErrors))("the %s error", (_name, envelope) => {
    expect(errorSchema.parse(envelope)).toStrictEqual(envelope);
  });

  it("list pages and listed campaigns", () => {
    const page = zeffyList([fixtures.recurringMembershipPayment], "next");
    expect(listSchema(paymentSchema).parse(page)).toStrictEqual(page);
    const listed = listedCampaign(fixtures.ticketingCampaign);
    expect(campaignSchema.parse(listed)).toStrictEqual(listed);
    expect(listed).not.toHaveProperty("rates");
  });
});
