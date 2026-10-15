# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing static HTML/CSS/JavaScript application on GitHub Pages, with the existing Supabase project for verified email accounts and owner-scoped leaderboard data. Retain this stack.

## Users

The wider North Carolina charter-school community. Visitors can play immediately as guests; community participation through the leaderboard is optional.

## Product Purpose

CharterSchoodle is a daily North Carolina charter-school guessing game: six clues, six guesses, one school. Make daily play easy on a phone and let players compare their daily results with the community.

## Capabilities and Constraints

Keep daily puzzles, prior puzzles, the NC school map, six-guess rules, feedback, spoiler-free sharing, and school/puzzle facts. Preserve published clues and answers. Account identity is verified by email; raw guesses and email remain private. Only chosen public names, optional affiliations, and aggregate scores appear in rankings. Keep owner-scoped writes, account isolation, private guest history, and conflict protections.

## Approved Joining Experience

The owner approved the full UI/UX redesign on October 15, 2026: keep CSP branding; put active clue and school picker together; rebuild mobile rankings; collect joining details in one form; email confirmation finishes setup automatically. Returning players retain their existing profile and privacy settings.

Include today's guest game from the requesting browser, with clear notice on the join form. Do not import archive games or older guest results. Existing account results take priority. This was explicitly approved by the owner.

## Brand Commitments

Keep CharterSchoodle and Charter Success Partners identity, supplied CSP logo, established green/sage/stone/white palette, and Open Sans. The redesign replaces the cluttered composition while retaining these commitments.

## Evidence on Hand

Real school and puzzle content in data/. Owner-confirmed production email delivery and successful real sign-in are recorded in docs/launch-evidence/2026-10-15/release-activation/. The full independent UI/UX review and screenshots are in .impeccable/critique/.

## Product Principles

- The first clue and school picker belong together and should be visible immediately on a phone.
- Joining ends with email confirmation; setup must not surprise players afterward.
- Community rankings keep names and school affiliations readable.
- Keep guest play available through account, storage, or ranking failures.
- Use clear public-listing consent and preserve private identity and ownership.

## Accessibility & Inclusion

Use semantic native controls, readable contrast/type, visible keyboard focus, accessible autocomplete/dialogs, comfortable touch targets, reduced-motion support, and reflow at 320px and increased text size. Provide a practical alternative to dense map-pin selection.
