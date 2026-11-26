# 0001 — Where members-only content is stored

Status: Accepted (Parker, 2026-11-26, Q-20261126-025236-15031, option A)

## Problem

Sanity's free plan appears to offer public datasets only. Published documents in a public dataset can be
read by anyone through Sanity's API, so a "members only" flag would hide content in the UI but not from
someone querying the API directly. The contract requires members-only content that is not publicly readable.

## Options

| Option | Monthly cost | Extra build | Notes |
| --- | --- | --- | --- |
| A. Sanity paid plan with a private dataset; fetch gated content server-side with a token | ~$15 per editor | none | Simplest for editors; recurring cost to the Society |
| B. Public content in Sanity; members-only bodies and files in Supabase (`gated_content` table + private Storage bucket, RLS by level), edited in `/admin` | $0 | ~6–8 hours | **Recommended.** Gated content is a small set; no new recurring cost |
| C. Accept the risk | $0 | none | Not acceptable — violates the contract |

## First step for the agent who picks this up

Verify on sanity.io/pricing whether the free plan allows a private dataset. If it does, recommend A at
$0 instead and say so in the question to Parker.

## Decision

**A — Sanity private dataset.** Members-only pages, posts, events and venue booking contacts live in a
private Sanity dataset and are fetched server-side with a read token, never from the browser. Editing stays
in the Studio with live preview and drafts.

Facts checked 2026-11-26 (sanity.io/pricing and docs; details in bead op-ed8):

- The free plan has public datasets only, so it can't be used for gated content.
- Growth is $15 per user per month (Viewers are free) and includes private datasets.
- The non-profit plan is free and "mirrors Growth". You apply with the Society's Sanity project ID, and a
  reply takes up to 14 business days.
- Files and images uploaded to Sanity are public by URL even in a private dataset. **Members-only files go
  in a private Supabase Storage bucket**, with access checked by membership level.

Cost: Parker approved paying Growth ($15 per editor per month) only to cover a gap before non-profit
approval, or if the non-profit plan is denied. Don't let a trial lapse with private data in it, because a
lapsed plan turns private datasets public.

Human-gated steps (not for agents): creating the Society's Sanity project (due Dec 3), applying for the
non-profit plan, and any paid plan change.
