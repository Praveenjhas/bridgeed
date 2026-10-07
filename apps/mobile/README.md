# BridgeEd Mobile

Expo (React Native) client for BridgeEd. This package currently contains the app
foundation: the navigation shell, the design system, the API layer, real mobile
**Authentication** built on a persisted session, four features — the ranked
**Feed** with post detail, comments and likes, **Communities** with membership,
rosters and community posts, and **Connections** with requests, blocks and
student profiles — and **Global search** over the academic graph. Posts are
**structured academic content**: every one is a discussion, question, resource,
achievement, research note, announcement or opportunity.

## Stack

| Concern      | Choice                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------- |
| Runtime      | Expo SDK 57 (`expo@~57.0.26`), React Native 0.86, React 19                                  |
| Navigation   | Expo Router 57, file based routes under `src/app`                                           |
| Language     | TypeScript (strict), path alias `@/*` → `src/*`                                             |
| Icons        | `@expo/vector-icons` (Ionicons), wrapped by `components/Icon`                               |
| Shared types | `@bridgeed/shared` (auth, feed, post, comment, reaction, community, connection, academic, search, pagination) |
| Formatting   | Prettier defaults (no config in this repo)                                                  |

## Getting started

```bash
# 1. from the repository root — installs every workspace
npm install

# 2. configure the API location
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

| Variable              | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `EXPO_PUBLIC_API_URL` | API root without `/api/v1`, e.g. `http://192.168.1.24:4000`. |

If `EXPO_PUBLIC_API_URL` is empty, the app falls back to the host of the Expo dev
server on port `4000` (the backend default), which is what makes the first local
run work without a `.env` file. A physical device can never reach `localhost`, so
set the variable explicitly whenever the guess is wrong.

That value is read through `src/config/env.ts`. Who the app is signed in as is no
longer configuration: it comes from the session the user established at sign-in.
The **Profile** tab shows the resolved API URL, the account and the student id it
is acting as — the fastest way to answer "why is my feed empty".

## Project structure

```text
src
├─ app/                     # routes only: every file here is a screen
│  ├─ _layout.tsx           # providers + guards: (tabs) vs (auth)
│  ├─ (tabs)/               # tab shell
│  │  ├─ _layout.tsx        # bottom tabs
│  │  ├─ index.tsx          # Feed (the built feature)
│  │  ├─ communities.tsx    # community directory + memberships
│  │  ├─ connections.tsx    # connections + requests + student cards
│  │  └─ profile.tsx        # account, configuration + sign out
│  ├─ (auth)/               # signed-out area, guarded by the session
│  │  ├─ _layout.tsx        # auth stack
│  │  ├─ login.tsx          # sign in
│  │  └─ register.tsx       # create an account
│  ├─ community/
│  │  └─ [communityId]/
│  │     ├─ index.tsx       # community detail: header, members, posts
│  │     └─ members.tsx     # member list + join requests
│  ├─ post/[postId].tsx     # post detail: post, comments, composer
│  ├─ student/[studentId].tsx  # student profile + connection actions
│  ├─ search.tsx            # global search over the academic graph
│  ├─ universities.tsx      # university directory: search + paging
│  ├─ universities/
│  │  └─ [universityId].tsx # university detail: programmes + communities
│  └─ programs/[programId].tsx # programme detail: university + subjects
├─ components/              # design system primitives, no feature knowledge
├─ config/                  # environment resolution (API base URL)
├─ features/                # feature-first code: api, hooks, components
│  ├─ auth/                 # auth api, session store, secure storage, form field
│  ├─ communities/          # community, membership, member and post api + hooks
│  ├─ connections/          # connection + request api, hooks, cards, profile CTA
│  ├─ feed/                 # feed api, useFeed, PostCard, summary, footer
│  ├─ post/                 # post + comment api, hooks, CommentRow, composer
│  ├─ reactions/            # like/unlike post
│  ├─ search/               # search api, useSearch, category rows and labels
│  ├─ students/             # student profile, university, skills and interests
│  └─ universities/         # university, programme and subject api + hooks
├─ hooks/                   # generic data hooks
├─ providers/               # app wide providers (safe area, session)
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

The same file attaches the session's bearer token to every request and, when a
guarded route answers `401`, refreshes the access token once and replays the
request. The credential callbacks are installed by the session layer
(`features/auth/session.ts`) through `setAuthInterceptor`, so the transport never
imports a feature.

Feature services own routes and response types, for example:

```ts
// features/feed/api/feed.api.ts
fetchFeedPage({ cursor, limit, signal }): Promise<FeedPage>
```

The acting account is never sent for these social routes: the API reads it from
the bearer token, so a client cannot act — post, comment, react, connect, join —
as somebody else. Only target resources (a post id, another student id, a
community id) travel in the request.

### Data hooks

- `hooks/usePaginatedList` — cursor or page-number lists with first load,
  refresh, load-more, in-place updates and protection against duplicate ids and
  repeated cursors.
- `hooks/useAsyncValue` — a single resource with the same loading, error and
  refresh semantics.
- `hooks/useDebouncedValue` — holds a value still for a moment, so typing a word
  into a search field is one request rather than one per letter.
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
- `features/search/hooks/useSearch` — the grouped answer rather than a flat list:
  the five categories, the count behind each of them and the page inside the one
  being read. A new term (or category) restarts it and clears what is on screen,
  so rows can never sit under a term they did not match; a term shorter than two
  characters is never sent at all.
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
`EmptyState`, `ErrorState` and `FeaturePlaceholder`. Lists reuse one row per kind
of thing — `UniversityRow`, `ProgramRow`, `SubjectRow`, `CommunityRow`,
`StudentRow` — and every search field in the app is the same `SearchField`, so a
directory and the search screen look and behave alike.

### Navigation

- `(tabs)` — Feed, Communities, Connections, Profile. Tabs use the JavaScript tab
  navigator (`expo-router/js-tabs`) so the bar is identical on both platforms and
  works in Expo Go.
- `(auth)/login` and `(auth)/register` — the signed-out area. The two groups are
  declared with `Stack.Protected` in `app/_layout.tsx`, so the tabs do not exist
  while nobody is signed in and the auth screens do not exist once somebody is.
  The guard flipping is the navigation; no screen redirects by hand.
- `community/[communityId]` — the community, pushed from the Communities tab.
- `community/[communityId]/members` — the roster, pushed from the community.
- `post/[postId]` — pushed on the root stack with the native header, so the
  platform back gesture and button come for free.
- `student/[studentId]` — a student profile, pushed from a connection card, a
  request or any other list, and the place the connection actions live.
- `universities` — the academic directory, pushed from the Home entry card: a
  searchable, paged list of universities with their programme, student and
  community counts, and a search action in its header for when what you wanted is
  not an institution.
- `universities/[universityId]` — one university with its programmes and the
  communities anchored to it.
- `programs/[programId]` — one programme with its university, the subjects it
  teaches, and the students and communities on it.
- `search` — global search, pushed from Home and from the university directory.

Every pushed screen keeps the native stack header (options are shared in
`app/_layout.tsx`); tab screens draw their own `PageHeader` so they can carry a
subtitle and trailing actions.

### Global search

One field, one endpoint: `GET /api/v1/search`. Without a `type` the API searches
universities, programmes, subjects, communities and students with the same term
and returns the first five of each with the total behind them, which is what the
screen shows while a student types: a section per category that matched, each
labelled with how many matches it holds, and a "See all" that reopens the same
screen as that category's paged listing. Categories with nothing in them are left
out rather than drawn empty.

The field is debounced by 300 ms, so a typed word is one request instead of one
per letter, and a term shorter than two characters is not sent at all — the screen
offers the five categories to narrow the search instead. Before a term exists the
categories are a picker, which is what makes "search only communities" a choice
rather than a filter applied after the fact. Results are rows from the shared
design system, so a university in search looks exactly like a university in the
directory. A subject has no screen of its own in v1, so its rows are not
pressable; every other row opens what it names.

The search is case insensitive and matches on the text a reader would type:
names first, then a city for an institution, a degree or field for a programme, a
description for a community, a handle, university or programme for a student. It
is not typo tolerant and does not fold accents — typing "enginering" finds
nothing — and this is a documented v1 boundary rather than an unfinished feature.

## What works today

| Area                 | State                                                                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication       | Register, sign in and sign out against `/api/v1/auth/*`, with the token pair kept in `expo-secure-store` (in memory where it is unavailable), a single refresh-and-retry when an access token expires, and route guards driven by the session |
| Feed                 | Real data from `GET /api/v1/feed`: cursor pagination, pull to refresh, skeletons, empty and error states, per item ranking reasons, and a summary built from `generatedAt` / `candidatesConsidered`                                           |
| Likes                | Optimistic like and unlike through `POST` / `DELETE /api/v1/posts/:postId/reactions`, with rollback and an inline error                                                                                                                       |
| Post detail          | `GET /api/v1/posts/:postId`, the comment thread from `GET /api/v1/posts/:postId/comments` with load-more, and posting through `POST /api/v1/posts/:postId/comments`                                                                           |
| Structured posts     | Seven canonical post types (`discussion`, `question`, `resource`, `achievement`, `research`, `announcement`, `opportunity`) chosen in the composer, labelled on every card and on the post screen, and filterable in a community from `GET …/posts?type=` |
| Communities          | The directory from `GET /api/v1/communities` (paged, searchable over what is loaded), the reader's own memberships from `GET /api/v1/student-profiles/:userId/communities`, and clear membership badges and CTAs                              |
| Community detail     | `GET /api/v1/communities/:communityId`, join and leave through `POST …/join` and `DELETE …/membership`, the roster from `GET …/members` and the posts from `GET …/posts` with a composer writing to `POST …/posts`                            |
| Join requests        | Owners and admins see pending requests on the member list and decide them with `PATCH /api/v1/community-memberships/:membershipId/approve` and `/reject`                                                                                      |
| Connections          | The accepted graph from `GET /api/v1/student-profiles/:userId/connections?status=accepted`, filtered locally by name or handle over what is loaded, with one card per student that opens their profile                                        |
| Connection requests  | Incoming pending requests from `GET /api/v1/student-profiles/:userId/connections/requests/received`, answered with `PATCH /api/v1/connections/:connectionId/accept` and `/reject`, with progress per row                                      |
| Student profile      | `GET /api/v1/student-profiles/:userId` with the university, skills and interests, plus a connection call to action derived from the API's own connection row                                                                                  |
| Relationship actions | `POST /api/v1/connections`, `DELETE /api/v1/connections/:connectionId/request`, `DELETE /api/v1/connections/:connectionId` and `POST /api/v1/connections/:connectionId/block`, each behind a confirmation where it ends something             |
| Academic discovery   | The university directory from `GET /api/v1/universities` (paged, name search, one counts line per row) and the subject catalog from `GET /api/v1/subjects`, reached from the Home entry card                                                  |
| University detail    | `GET /api/v1/universities/:universityId` (and the same document by `/slug/:slug`): its programmes, the communities anchored to it and the programme/student/community counts                                                                  |
| Programme detail     | `GET /api/v1/programs/:programId` with its university, the subjects it teaches and the student and community counts, plus `GET /api/v1/universities/:universityId/programs` for the list                                                      |
| Academic context     | A student profile records the programme it is enrolled in, and a community may carry an optional university, programme and/or subject, shown resolved to names on the community screen                                                        |
| Global search        | `GET /api/v1/search` from the Home card and the university directory's header: one term across universities, programmes, subjects, communities and students, grouped with per category counts, a "See all" that pages inside one category, and the searcher's own profile left out of the student results |
| Profile              | Placeholder: the account and configuration it reports are real, the editable profile is not                                                                                                                                                   |

Deliberately not built yet: unblocking a student (the API exposes no unblock
route, so a block is one way from the app), editing a profile, password reset,
and comment reactions —
the comment listing does not report whether the reading student already liked a
comment, so a toggle would be guessing. Community post cards show the like count
as a number for the same reason: the community listing does not report the
reader's reaction, and only the feed does. Blocking is offered only where a
connection row already exists, because that row is what the block acts on.

Post types structure what a post is; they do not add anything behind it. There is
no answer entity with an accepted answer, no resource model, no file or PDF
upload, no research paper metadata and no bookmarking, and creating an
announcement grants no extra authority — publishing on behalf of a university or
a club is a later phase. The feed deliberately has no type filter either: it is
ranked and cursor paged, and narrowing it would mean a second ranking path rather
than a parameter, so the type is shown on every item and the filter lives where
the listing is a plain newest-first page.

Search v1 stops where the data does. It matches text rather than meaning: no
typos, no stemming ("teaching" does not find "teacher") and no accent folding. A
subject has no detail screen, so a subject result cannot be opened, and there is
no post, question or resource category: search covers the academic graph, and
searching the content itself arrives when the content model is richer than one
text field — an empty section would be a promise the product cannot keep.

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
