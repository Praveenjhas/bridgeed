/**
 * Page sizes for the community screens.
 *
 * They are smaller than the shared API defaults because these lists are read on
 * a phone: fetching twenty rows up front spends network and memory on content the
 * reader has not scrolled to.
 */
export const COMMUNITIES_PAGE_LIMIT = 12;

/** Members fetched per page on the member list. */
export const MEMBERS_PAGE_LIMIT = 20;

/** Members fetched for the preview card on a community screen. */
export const MEMBERS_PREVIEW_LIMIT = 12;

/** Posts fetched per page inside a community. */
export const COMMUNITY_POSTS_PAGE_LIMIT = 10;

/** How many member avatars the preview card shows before it summarises. */
export const MEMBERS_PREVIEW_AVATARS = 8;

/**
 * Longest post the API accepts.
 *
 * It mirrors `MAX_POST_CONTENT_LENGTH` in
 * `apps/api/src/services/post.service.ts`, which answers
 * "Post content must be at most 5000 characters" with a 400. The value is
 * duplicated here only so the composer can count down and disable its button
 * before a round trip; the API stays the authority and its error is shown as is.
 */
export const MAX_POST_CONTENT_LENGTH = 5000;
