import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EventCard } from "@/components/ui/event-card";
import {
  CheckboxField,
  Fieldset,
  FormError,
  SelectField,
  SuccessBox,
  TextareaField,
  TextField,
} from "@/components/ui/form-fields";
import { LockOverlay } from "@/components/ui/lock-overlay";
import { PostCard } from "@/components/ui/post-card";
import { SponsorLogo } from "@/components/ui/sponsor-logo";
import { Table } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { ToastProvider } from "@/components/ui/toast";
import { ModalDemo, PillFiltersDemo, ToastDemo } from "./demos";

export const metadata: Metadata = {
  title: "Components (development only)",
  robots: { index: false, follow: false },
};

// Placeholder content, in the concept's style (docs/design/prototype.html).
const MEMBERS = [
  { name: "Jordan Ellis", level: "Individual", status: "Active", expires: "Mar 14, 2027" },
  { name: "Sam Okafor", level: "Band", status: "Expiring soon", expires: "Dec 20, 2026" },
  { name: "Riley Brooks", level: "Business", status: "Lapsed", expires: "Oct 2, 2026" },
] as const;

const STATUS_TONE = { Active: "success", "Expiring soon": "accent", Lapsed: "danger" } as const;

/**
 * Every component in components/ui with placeholder content (backlog D-3), for checking them at
 * phone and desktop widths. Development only: production builds answer 404.
 */
export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <ToastProvider>
      <main className="mx-auto w-full max-w-site px-gutter py-section">
        <p className="text-eyebrow text-accent-dark uppercase">Development only</p>
        <h1>Components</h1>
        <p className="mt-2 text-lead text-muted">
          The shared components in <code>components/ui</code>, documented in
          docs/design/components.md. Production builds don&apos;t serve this page.
        </p>

        <Section title="Button">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Become a Member</Button>
            <Button variant="dark">Complete membership</Button>
            <Button variant="ghost">Turn off auto-renew</Button>
            <Button variant="approve" size="sm">
              Approve
            </Button>
            <Button variant="reject" size="sm">
              Reject
            </Button>
            <Button size="sm">Small</Button>
            <Button disabled>Disabled</Button>
            <ButtonLink href="/dev/components" variant="dark" size="sm">
              A link styled as a button
            </ButtonLink>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 rounded-card bg-primary-dark p-5 text-white">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
            <Button size="sm">Join</Button>
          </div>
        </Section>

        <Section title="Card">
          <Card className="max-w-md p-6">
            <h3>Volunteer with us</h3>
            <p className="mt-2 text-small text-muted">A card holds a panel of related content.</p>
          </Card>
        </Section>

        <Section title="Tag">
          <div className="flex flex-wrap gap-2">
            <Tag>Concert</Tag>
            <Tag tone="accent">Members only</Tag>
            <Tag tone="success">Active</Tag>
            <Tag tone="danger">Lapsed</Tag>
            <Tag tone="muted">Weekly</Tag>
          </div>
        </Section>

        <Section title="Pill filters">
          <PillFiltersDemo />
        </Section>

        <Section title="Table">
          <Card>
            <Table
              caption="Members"
              columns={[
                { key: "name", header: "Name", cell: (row) => row.name, rowHeader: true },
                { key: "level", header: "Level", cell: (row) => row.level },
                {
                  key: "status",
                  header: "Status",
                  cell: (row) => <Tag tone={STATUS_TONE[row.status]}>{row.status}</Tag>,
                },
                { key: "expires", header: "Expires", cell: (row) => row.expires },
              ]}
              rows={MEMBERS}
              rowKey={(row) => row.name}
            />
          </Card>
        </Section>

        <Section title="Form fields">
          <Card className="grid max-w-xl gap-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="First name" name="first" autoComplete="given-name" />
              <TextField label="Last name" name="last" autoComplete="family-name" />
            </div>
            <TextField
              label="Email"
              name="email"
              type="email"
              defaultValue="jordan@example"
              error="Enter an email address like name@example.com."
            />
            <SelectField label="Category" name="category" defaultValue="gear">
              <option value="musicians-wanted">Musicians Wanted</option>
              <option value="gear">Gear</option>
              <option value="merch">Merch</option>
            </SelectField>
            <TextareaField
              label="Details"
              name="details"
              hint="Listings are reviewed by a moderator before going live."
            />
            <Fieldset legend="I can help with…">
              <CheckboxField label="Door / merch table at shows" name="help" value="door" />
              <CheckboxField label="Blues in the Schools" name="help" value="schools" />
            </Fieldset>
            <CheckboxField
              label="Renew automatically each year"
              hint="Cancel anytime."
              name="renew"
              defaultChecked
            />
            <FormError>
              The upload didn&apos;t finish. Check your connection and try again.
            </FormError>
            <SuccessBox>
              <p className="font-semibold">Check your email.</p>
              <p className="mt-1">A sign-in link is on its way.</p>
            </SuccessBox>
          </Card>
        </Section>

        <Section title="Modal">
          <ModalDemo />
        </Section>

        <Section title="Toast">
          <ToastDemo />
        </Section>

        <Section title="Lock overlay">
          <LockOverlay
            description="Sign in to see the venue directory, or join for $30 a year."
            headingLevel={3}
          />
        </Section>

        <Section title="Event card">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(16.25rem,1fr))] gap-5">
            <EventCard
              title="Delta Night: Mavis Crane Band"
              href="/events"
              startsAt="2026-12-05T02:00:00Z"
              category="Concert"
              venue="Old Mill Music Hall"
              price="$15"
              memberPrice="$10"
            />
            <EventCard
              title="Tuesday Night Blues Jam"
              href="/events"
              startsAt="2026-12-09T01:30:00Z"
              category="Jam"
              repeats="weekly"
              venue="The Riverside Tap"
              price="Free"
            />
            <EventCard
              title="Members' Holiday Social"
              href="/events"
              startsAt="2026-12-13T00:00:00Z"
              category="Society"
              membersOnly
              price="Free for members"
            />
          </div>
        </Section>

        <Section title="Post card">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(16.25rem,1fr))] gap-5">
            <PostCard
              title="Fall Fest Recap: 1,200 Fans and a Whole Lot of Slide Guitar"
              href="/blog"
              publishedAt="2026-10-14T15:00:00Z"
              category="Recap"
              excerpt="Two days, eleven bands, and one very muddy field."
            />
            <PostCard
              title="Board Notes — October"
              href="/blog"
              publishedAt="2026-10-03T15:00:00Z"
              category="Society News"
              locked
            />
          </div>
        </Section>

        <Section title="Sponsor logo">
          <div className="flex flex-wrap items-center gap-3.5">
            <SponsorLogo name="Riverbend Brewing Co." placement="large" />
            <SponsorLogo name="Old Mill Music Hall" href="/sponsors" />
            <SponsorLogo name="Hilltop Guitar Works" placement="name" />
          </div>
        </Section>
      </main>
    </ToastProvider>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4">{title}</h2>
      {children}
    </section>
  );
}
