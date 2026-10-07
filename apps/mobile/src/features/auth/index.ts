/**
 * Public surface of the auth feature.
 *
 * It exposes the pieces a screen renders: the shared frame for the two credential
 * screens, the switch between them, the password rules and the development-only
 * tracer. The session itself is published through `@/providers/AuthProvider`, and
 * the raw endpoints stay internal to `./session`, so screens never call `/auth/*`
 * directly.
 *
 * The form field itself is not here: `TextField` lives in `@/components` because
 * post creation, profile editing and student onboarding all need the same labelled
 * input, and a field that only the auth screens could use would be copied the first
 * time one of them was built.
 */
export {
  AuthScaffold,
  type AuthScaffoldProps,
} from "./components/AuthScaffold";
export {
  AuthSwitchPrompt,
  type AuthSwitchPromptProps,
} from "./components/AuthSwitchPrompt";
export { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "./constants";
export {
  describeAuthError,
  describeApiLocation,
  logAuthEvent,
  type AuthLogEvent,
  type AuthLogMeta,
} from "./dev-log";
