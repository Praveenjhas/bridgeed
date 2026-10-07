import { useRef, useState } from "react";
import { TextInput } from "react-native";
import { router } from "expo-router";
import { Button, InlineError, TextField } from "@/components";
import {
  AuthScaffold,
  AuthSwitchPrompt,
  describeAuthError,
  logAuthEvent,
} from "@/features/auth";
import { useAuth } from "@/providers/AuthProvider";
import { toUserMessage } from "@/utils/errors";

/**
 * Sign-in screen.
 *
 * It owns nothing but the form. `login` resolves, the session module persists the
 * token pair and publishes it, and the root guard swaps this screen for the
 * tabs. There is deliberately no `router.replace` here: navigating by hand would
 * race the guard that is already doing it.
 *
 * Presentation is delegated: `AuthScaffold` draws the brand, the headline and the
 * card, and `TextField` / `Button` carry the field and button states. That is what
 * keeps this screen and sign-up from drifting apart.
 */
export default function LoginScreen() {
  const { login } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedEmail = email.trim();
  const canSubmit =
    trimmedEmail.length > 0 && password.length > 0 && !isSubmitting;

  async function submit() {
    // First, so the log proves the press actually reached the handler even when
    // a later check turns the submit away.
    logAuthEvent("LOGIN_BUTTON_PRESSED", { email: trimmedEmail });

    if (!canSubmit) {
      return;
    }

    logAuthEvent("LOGIN_VALIDATION_PASSED");

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(trimmedEmail, password);
      // On success the guard unmounts this screen, so its state is not reset.
    } catch (error) {
      logAuthEvent("LOGIN_ERROR", describeAuthError(error));
      setErrorMessage(toUserMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScaffold
      title="Your campus, connected."
      subtitle="Meet students, find communities, and build your university network."
      footer={
        <AuthSwitchPrompt
          prompt="Don't have an account?"
          actionLabel="Create account"
          onPress={() => router.push("/register")}
        />
      }
    >
      <TextField
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        placeholder="you@university.edu"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        editable={!isSubmitting}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        autoCapitalize="none"
        autoComplete="current-password"
        secureTextEntry
        textContentType="password"
        returnKeyType="go"
        editable={!isSubmitting}
        onSubmitEditing={submit}
      />

      {errorMessage !== null ? (
        <InlineError
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      ) : null}

      <Button
        label="Sign in"
        size="lg"
        onPress={submit}
        loading={isSubmitting}
        disabled={!canSubmit}
        fullWidth
      />
    </AuthScaffold>
  );
}
