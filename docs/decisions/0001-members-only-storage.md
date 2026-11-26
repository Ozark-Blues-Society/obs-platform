# 0001 — Where members-only content is stored

Status: Proposed (needs Parker's approval — human gate)

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

(Filled in when Parker answers.)
