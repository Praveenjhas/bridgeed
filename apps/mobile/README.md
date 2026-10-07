# BridgeEd Mobile

Expo (React Native) client for BridgeEd. This package currently contains the app
foundation: the navigation shell, the design system, the API layer and four real
features — the ranked **Feed** with post detail, comments and likes,
**Communities** with membership, rosters and community posts, and
**Connections** with requests, blocks and student profiles.

## Stack

| Concern      | Choice                                                                                |
| ------------ | ------------------------------------------------------------------------------------- |
| Runtime      | Expo SDK 57 (`expo@~57.0.26`), React Native 0.86, React 19                            |
| Navigation   | Expo Router 57, file based routes under `src/app`                                     |
| Language     | TypeScript (strict), path alias `@/*` → `src/*`                                       |
| Icons        | `@expo/vector-icons` (Ionicons), wrapped by `components/Icon`                         |
| Shared types | `@bridgeed/shared` (feed, post, comment, reaction, community, connection, pagination) |
| Formatting   | Prettier defaults (no config in this repo)                                            |

## Getting started

```bash
# 1. from the repository root — installs every workspace
npm install

# 2. configure the API location and the development actor
cd apps/mobile
cp .env.example .env      # Windows: copy .env.example .env
# then edit .env

# 3. run the backend (separate terminal, from the repository root)
cd apps/api
npm run dev

# 4. run the app
cd apps/mobile
npm start            # then press a (Android), i (iOS) or w (web)
```

Step 4 has to run with `apps/mobile` as the Expo project root. Starting
`npx expo start` from the repository root makes Expo treat the monorepo root as
the project, where `package.json` has no `main` field; Expo then falls back to
its legacy entry `expo/AppEntry.js`, which imports `../../App`, and bundling
fails with `Unable to resolve "../../App" from "node_modules/expo/AppEntry.js"`.
From the repository root use `npm start` (or `npm run android`), which forward
to this workspace and its `expo-router/entry`.

### Environment variables

Only `EXPO_PUBLIC_*` variables are inlined into the bundle by Metro, so they are
never the place for secrets.

| Variable               | Purpose                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_API_URL`  | API root without `/api/v1`, e.g. `http://192.168.1.24:4000`.                                                       |
| `EXPO_PUBLIC_ACTOR_ID` | The student the app acts as. Required: every content endpoint takes an explicit actor until authentication exists. |

If `EXPO_PUBLIC_API_URL` is empty, the app falls back to the host of the Expo dev
server on port `4000` (the backend default), which is what makes the first local
run work without a `.env` file. A physical device can never reach `localhost`, so
set the variable explicitly whenever the guess is wrong.

Both values are read through `src/config/env.ts` and `src/config/actor.ts`. The
**Profile** tab shows exactly what the app resolved, which is the fastest way to
answer "why is my feed empty".

## Project structure

```text
src
├─ app/                     # routes only: every file here is a screen
│  ├─ _layout.tsx           # providers + stack (tabs, community, post, student)
│  ├─ (tabs)/               # tab shell
│  │  ├─ _layout.tsx        # bottom tabs
│  │  ├─ index.tsx          # Feed (the built feature)
│  │  ├─ communities.tsx    # community directory + memberships
│  │  ├─ connections.tsx    # connections + requests + student cards
│  │  └─ profile.tsx        # configuration + profile placeholder
│  ├─ community/
│  │  └─ [communityId]/
│  │     ├─ index.tsx       # community detail: header, members, posts
│  │     └─ members.tsx     # member list + join requests
│  ├─ post/[postId].tsx     # post detail: post, comments, composer
│  └─ student/[studentId].tsx  # student profile + connection actions
├─ components/              # design system primitives, no feature knowledge
├─ config/                  # environment and actor resolution
├─ features/                # feature-first code: api, hooks, components
│  ├─ communities/          # community, membership, member and post api + hooks
│  ├─ connections/          # connection + request api, hooks, cards, profile CTA
│  ├─ feed/                 # feed api, useFeed, PostCard, summary, footer
│  ├─ post/                 # post + comment api, hooks, CommentRow, composer
│  ├─ reactions/            # like/unlike post
│  └─ students/             # student profile, university, skills and interests
├─ hooks/                   # generic data hooks
├─ providers/               # app wide providers (safe area, actor)
├─ services/api/            # transport: fetch wrapper, base URL, errors
├─ theme/                   # design tokens
├─ types/                   # ambient type references
└─ utils/                   # formatting and error helpers
```

### Rules of thumb

- `src/app` only wires routes together. Anything reusable lives outside it.
- A feature owns its `api/`, `hooks/` and `components/` folders, and exposes them
  through a single `index.ts`. Screens import from the feature, never from a deep
  path.
- Screens never call `fetch`. Data access goes
  `screen → feature hook → feature api → services/api`.
- Components never contain hex colors, magic spacing or font sizes: everything
  comes from `useTheme()`.
- Shared contracts come from `@bridgeed/shared`; do not redeclare feed, post,
  comment, community, connection or membership shapes locally. The one exception
  is a card view model such as `PostCardItem`, which deliberately transforms a
  contract instead of duplicating it.

## Architecture in one pass

### API layer

`services/api/client.ts` owns transport only: base URL (`…/api/v1`), JSON
encoding, a 15 second timeout, cancellation and error normalisation. Every
failure becomes an `ApiError` carrying a message that is already safe to display;
a missing API address stays an `ApiConfigurationError` because it needs setup
instructions instead of a retry button.

Feature services own routes and response types, for example:

```ts
// features/feed/api/feed.api.ts
fetchFeedPage({ actorId, cursor, limit, signal }): Promise<FeedPage>
```

### Data hooks

- `hooks/usePaginatedList` — cursor or page-number lists with first load,
  refresh, load-more, in-place updates and protection against duplicate ids and
  repeated cursors.
- `hooks/useAsyncValue` — a single resource with the same loading, error and
  refresh semantics.
- `features/feed/hooks/useFeed` — composes `usePaginatedList` with optimistic
  likes (patched immediately, rolled back on failure) and exposes the ranking
  metadata of the last page.
- `features/post/hooks/usePostDetails` and `usePostComments` — the detail slice,
  including posting a comment and reloading the thread once it is accepted.
- `features/communities/hooks` — one hook per concern:
  `useCommunities` (directory), `useCommunity`, `useCommunityMemberships` (the
  student's memberships, the single source of membership truth),
  `useCommunityMembership` (state plus join and leave, with every derived flag),
  `useCommunityMembers` (a paged roster for one status, used by both the member
  list and the join requests), `useMembershipRequestActions` (approve and reject)
  and `useCommunityPosts` (reading and writing posts).
- `features/connections/hooks` — `useConnections` (the accepted graph),
  `useConnectionRequests` (received pending requests), `useRelationship` (where
  the reader stands with one student, the single source of relationship truth)
  and `useConnectionActions` (connect, accept, reject, withdraw, remove and
  block, with progress tracked per target).
- `features/students/hooks` — `useStudentProfile`, `useStudentProfiles` (one
  batch read for the people in a connection list), `useUniversity` (cached,
  because one university is shared by many students), `useStudentSkills` and
  `useStudentInterests`.

Both generic hooks abort the previous request when a new one starts, ignore
responses from a sequence that is no longer current, and never write state after
unmount.

### Design system

Tokens in `theme/` (colors, spacing, typography, radius, elevation, layout) are
the only source of visual values. `useTheme()` returns the active theme, so a
future dark mode or high contrast theme changes one file.

Components in `components/` cover the state space a screen needs: `Screen`,
`PageHeader`, `SectionHeading`, `Card`, `Divider`, `AppText`, `Button`, `Badge`,
`Icon`, `IconButton`, `Avatar`, `InlineError`, `LoadingState`, `SkeletonList`,
`EmptyState`, `ErrorState` and `FeaturePlaceholder`.

### Navigation

- `(tabs)` — Feed, Communities, Connections, Profile. Tabs use the JavaScript tab
  navigator (`expo-router/js-tabs`) so the bar is identical on both platforms and
  works in Expo Go.
- `community/[communityId]` — the community, pushed from the Communities tab.
- `community/[communityId]/members` — the roster, pushed from the community.
- `post/[postId]` — pushed on the root stack with the native header, so the
  platform back gesture and button come for free.
- `student/[studentId]` — a student profile, pushed from a connection card, a
  request or any other list, and the place the connection actions live.

Every pushed screen keeps the native stack header (options are shared in
`app/_layout.tsx`); tab screens draw their own `PageHeader` so they can carry a
subtitle and trailing actions.

## What works today

| Area                 | State                                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feed                 | Real data from `GET /api/v1/feed`: cursor pagination, pull to refresh, skeletons, empty and error states, per item ranking reasons, and a summary built from `generatedAt` / `candidatesConsidered`                               |
| Likes                | Optimistic like and unlike through `POST` / `DELETE /api/v1/posts/:postId/reactions`, with rollback and an inline error                                                                                                           |
| Post detail          | `GET /api/v1/posts/:postId`, the comment thread from `GET /api/v1/posts/:postId/comments` with load-more, and posting through `POST /api/v1/posts/:postId/comments`                                                               |
| Communities          | The directory from `GET /api/v1/communities` (paged, searchable over what is loaded), the reader's own memberships from `GET /api/v1/student-profiles/:userId/communities`, and clear membership badges and CTAs                  |
| Community detail     | `GET /api/v1/communities/:communityId`, join and leave through `POST …/join` and `DELETE …/membership`, the roster from `GET …/members` and the posts from `GET …/posts` with a composer writing to `POST …/posts`                |
| Join requests        | Owners and admins see pending requests on the member list and decide them with `PATCH /api/v1/community-memberships/:membershipId/approve` and `/reject`                                                                          |
| Connections          | The accepted graph from `GET /api/v1/student-profiles/:userId/connections?status=accepted`, filtered locally by name or handle over what is loaded, with one card per student that opens their profile                            |
| Connection requests  | Incoming pending requests from `GET /api/v1/student-profiles/:userId/connections/requests/received`, answered with `PATCH /api/v1/connections/:connectionId/accept` and `/reject`, with progress per row                          |
| Student profile      | `GET /api/v1/student-profiles/:userId` with the university, skills and interests, plus a connection call to action derived from the API's own connection row                                                                      |
| Relationship actions | `POST /api/v1/connections`, `DELETE /api/v1/connections/:connectionId/request`, `DELETE /api/v1/connections/:connectionId` and `POST /api/v1/connections/:connectionId/block`, each behind a confirmation where it ends something |
| Profile              | Placeholder: the configuration it reports is real, the editable profile is not                                                                                                                                                    |

Deliberately not built yet: unblocking a student (the API exposes no unblock
route, so a block is one way from the app), editing a profile, authentication (the
actor still comes from configuration), and comment reactions —
the comment listing does not report whether the reading student already liked a
comment, so a toggle would be guessing. Community post cards show the like count
as a number for the same reason: the community listing does not report the
reader's reaction, and only the feed does. Blocking is offered only where a
connection row already exists, because that row is what the block acts on.

## Checks

```bash
npm run typecheck                     # tsc --noEmit, with typed routes
npx prettier --check src README.md    # formatting of every source file and this file
npx expo-doctor                       # dependency and config diagnosis
npx expo export --platform android    # bundles the app without a device
npx expo install --fix                # align package versions with the SDK
```

Run `npx expo start` once before `npm run typecheck` on a fresh clone: typed
routes generate `.expo/types/router.d.ts`, which makes `router.push` and route
params type checked.
