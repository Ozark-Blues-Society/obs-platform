// The two email lists people choose for themselves, kept as groups in the Society's MailerLite
// account (decisions 0015 and 0016):
//   - "Newsletter": the monthly newsletter, a digest of new blog posts and upcoming shows. Visitors
//     join it from the box on the blog (subscribeToNewsletter);
//   - "Event announcements": shows and events as they're announced.
// Members are put in both when the member group sync first adds them to MailerLite, unless their
// membership has already lapsed (lib/mailerlite/sync.ts), and switch either one off or on again on
// My Account (readEmailChoices, saveEmailChoices). Each campaign goes to its list's group.
//
// MailerLite is the only record of who's in them. The site reads a member's choices from MailerLite
// each time, so the switches always agree with MailerLite's unsubscribe link and with what volunteers
// change there. Like the member groups, the site finds the two groups by name, and makes one that's
// missing when it has someone to put in it.
//
// Off until MAILERLITE_API_KEY is set (lib/mailerlite/client.ts).

import {
  MailerLiteError,
  type MailerLiteClient,
  type MailerLiteSubscriber,
  type SubscriberStatus,
} from "./client";

/** The lists' groups in MailerLite, by name. */
export const TOPIC_GROUPS = {
  newsletter: "Newsletter",
  events: "Event announcements",
} as const;

export type Topic = keyof typeof TOPIC_GROUPS;

export const TOPICS = Object.keys(TOPIC_GROUPS) as Topic[];

/** Whether someone gets each list. */
export type EmailChoices = Record<Topic, boolean>;

/** The statuses MailerLite sends no campaign to until the subscriber asks to come back. */
const BLOCKED: readonly SubscriberStatus[] = ["unsubscribed", "bounced", "junk"];

/**
 * The lists' group ids. A group that doesn't exist yet is left out, unless `create` names its list:
 * then it's made.
 */
export async function findTopicGroups(
  client: MailerLiteClient,
  create: readonly Topic[] = [],
): Promise<Partial<Record<Topic, string>>> {
  // An account holds at most 1,000 groups: one request lists them all.
  const existing = await client.listGroups();
  const ids: Partial<Record<Topic, string>> = {};
  for (const topic of TOPICS) {
    const name = TOPIC_GROUPS[topic];
    let id = existing.find((group) => group.name === name)?.id;
    if (!id && create.includes(topic)) {
      try {
        ({ id } = await client.createGroup(name));
      } catch (error) {
        // Group names are unique in an account: someone may just have made it.
        if (!(error instanceof MailerLiteError && error.status === 422)) throw error;
        id = (await client.listGroups(name)).find((group) => group.name === name)?.id;
        if (!id) throw error;
      }
    }
    if (id) ids[topic] = id;
  }
  return ids;
}

/**
 * Signs someone up for the newsletter from the box on the blog (decision 0015): adds the address to
 * the Newsletter group. A new subscriber gets MailerLite's double opt-in: MailerLite emails them a
 * link to confirm, and the newsletter reaches them once they do. That needs the account's double
 * opt-in setting for the API to be on (README, "Newsletter signup and email switches"). An address
 * MailerLite already has joins the group as it is, as with MailerLite's own forms.
 *
 * Anyone can type any address in the box, so it never brings back someone who unsubscribed, bounced
 * or marked a campaign as spam: MailerLite refuses those (422), as it does an address it won't take,
 * and nothing changes. The visitor is told the same either way, so the box doesn't tell anyone who's
 * on the list. Throws when MailerLite can't be reached or refuses the request otherwise.
 */
export async function subscribeToNewsletter(
  client: MailerLiteClient,
  email: string,
): Promise<"added" | "refused"> {
  const { newsletter } = await findTopicGroups(client, ["newsletter"]);
  if (!newsletter) throw new Error("The Newsletter group couldn't be found or made");
  try {
    await client.upsertSubscriber({ email, fields: {}, groups: [newsletter] });
    return "added";
  } catch (error) {
    if (error instanceof MailerLiteError && error.status === 422) return "refused";
    throw error;
  }
}

/** Who a member is to MailerLite. */
export interface MemberAddress {
  /** The address they sign in with. */
  email: string;
  /**
   * Their subscriber's id, as the member group sync recorded it (mailerlite_subscribers), or null.
   * Members can change their address in MailerLite's preference center, so the id finds them first.
   */
  subscriberId: string | null;
}

/** What My Account shows. */
export interface EmailChoicesState {
  /** Whether each list reaches the member: they're in its group and MailerLite sends them campaigns. */
  choices: EmailChoices;
  /**
   * MailerLite has the member but sends them no campaign: they haven't confirmed their address yet,
   * or they unsubscribed, bounced or marked a campaign as spam. Choosing a list and saving brings
   * them back.
   */
  paused: boolean;
}

async function findMember(
  client: MailerLiteClient,
  member: MemberAddress,
): Promise<MailerLiteSubscriber | null> {
  if (member.subscriberId) {
    const byId = await client.getSubscriber(member.subscriberId);
    if (byId) return byId;
  }
  return client.getSubscriber(member.email);
}

/** The member's choices as MailerLite has them. Throws when MailerLite can't be reached. */
export async function readEmailChoices(
  client: MailerLiteClient,
  member: MemberAddress,
): Promise<EmailChoicesState> {
  const [groups, subscriber] = await Promise.all([
    findTopicGroups(client),
    findMember(client, member),
  ]);
  const active = subscriber?.status === "active";
  const choices = {} as EmailChoices;
  for (const topic of TOPICS) {
    const id = groups[topic];
    choices[topic] = active && id !== undefined && subscriber.groupIds.includes(id);
  }
  return { choices, paused: subscriber !== null && !active };
}

/**
 * Saves the member's choices from My Account (decision 0016): puts them in the groups of the lists
 * they chose and takes them out of the others. Returns what MailerLite now has.
 *
 * Choosing any list makes the member an active subscriber: a new one, one who hadn't confirmed their
 * address (signing in to the site shows it's theirs), or one who unsubscribed, bounced or marked a
 * campaign as spam. Choosing a list on their own account is asking to get emails again, the one case
 * in which MailerLite allows a resubscribe. Choosing neither takes them out of both groups and
 * changes nothing else: campaigns to the member groups, which are about their membership, still
 * reach them. Throws when MailerLite can't be reached or refuses a request.
 */
export async function saveEmailChoices(
  client: MailerLiteClient,
  member: MemberAddress,
  choices: EmailChoices,
): Promise<EmailChoicesState> {
  const chosen = TOPICS.filter((topic) => choices[topic]);
  const [groups, subscriber] = await Promise.all([
    findTopicGroups(client, chosen),
    findMember(client, member),
  ]);
  const chosenIds = chosen.map((topic) => groups[topic]).filter((id) => id !== undefined);

  let subscriberId = subscriber?.id ?? null;
  let groupIds = subscriber?.groupIds ?? [];
  if (chosen.length > 0) {
    const blocked = subscriber !== null && BLOCKED.includes(subscriber.status);
    ({ id: subscriberId } = await client.upsertSubscriber({
      // Their address in MailerLite, which can differ from the one they sign in with.
      email: subscriber?.email ?? member.email,
      fields: {},
      groups: chosenIds,
      ...(blocked ? { resubscribe: true } : { status: "active" }),
    }));
    groupIds = [...groupIds, ...chosenIds];
  }
  if (subscriberId) {
    for (const topic of TOPICS) {
      const id = groups[topic];
      if (!choices[topic] && id !== undefined && groupIds.includes(id)) {
        await client.removeFromGroup(subscriberId, id);
      }
    }
  }
  return {
    choices: { ...choices },
    paused: chosen.length === 0 && subscriber !== null && subscriber.status !== "active",
  };
}
