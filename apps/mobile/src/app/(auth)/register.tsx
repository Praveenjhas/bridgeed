import { useRef, useState } from "react";
import { TextInput } from "react-native";
import { router } from "expo-router";
import { Button, InlineError, TextField } from "@/components";
import {
  AuthScaffold,
  AuthSwitchPrompt,
  describeAuthError,
  logAuthEvent,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/features/auth";
import { useAuth } from "@/providers/AuthProvider";
import { toUserMessage } from "@/utils/errors";

/** The field a password problem belongs to, so the message can land under it. */
type RegisterField = "password" | "confirmPassword";

interface ValidationIssue {
  field: RegisterField;
  message: string;
}

/**
 * Sign-up screen.
 *
 * The API signs the new account in as part of registration, so a successful
 * submit needs no follow-up sign-in call: the root guard reacts to the session the
 * same way it does after a login. The password rules are checked here first so an
 * obvious mistake is answered instantly, and the API validates them again.
 *
 * A rejected value is reported on the field that caused it rather than as a single
 * banner for the whole form. The message takes the place of that field's helper
 * line, so pointing out a mistyped password does not push the button the student
 * is about to press further down the card.
 */
export default function RegisterScreen() {
  const { register } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldIssue, setFieldIssue] = useState<ValidationIssue | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedEmail = email.trim();
  const canSubmit =
    trimmedEmail.length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    !isSubmitting;

  /** Returns the first problem with the form, or null when it is ready. */
  function validate(): ValidationIssue | null {
    if (password.length < PASSWORD_MIN_LENGTH) {
      return {
        field: "password",
        message: `Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`,
      };
    }

    if (password.length > PASSWORD_MAX_LENGTH) {
      return {
        field: "password",
        message: `Use at most ${PASSWORD_MAX_LENGTH} characters for your password.`,
      };
    }

    if (password !== confirmPassword) {
      return {
        field: "confirmPassword",
        message: "The two passwords do not match.",
      };
    }

    return null;
  }

  /** Clears the complaint on a field as soon as that field is edited again. */
  function editPassword(value: string) {
    setPassword(value);
    setFieldIssue((issue) => (issue?.field === "password" ? null : issue));
  }

  function editConfirmPassword(value: string) {
    setConfirmPassword(value);
    setFieldIssue((issue) =>
      issue?.field === "confirmPassword" ? null : issue,
    );
  }

  async function submit() {
    // First, so the log proves the press actually reached the handler even when
    // a later check turns the submit away.
    logAuthEvent("REGISTER_BUTTON_PRESSED", { email: trimmedEmail });

    if (!canSubmit) {
      return;
    }

    const validationIssue = validate();

    if (validationIssue !== null) {
      logAuthEvent("REGISTER_ERROR", {
        category: "validation",
        message: validationIssue.message,
      });
      setFieldIssue(validationIssue);
      return;
    }

    logAuthEvent("REGISTER_VALIDATION_PASSED");

    setFieldIssue(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await register(trimmedEmail, password);
      // On success the guard unmounts this screen, so its state is not reset.
    } catch (error) {
      logAuthEvent("REGISTER_ERROR", describeAuthError(error));
      setErrorMessage(toUserMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScaffold
      title="Create your BridgeEd account"
      subtitle="Join the communities you belong to and connect with other students."
      footer={
        <AuthSwitchPrompt
          prompt="Already have an account?"
          actionLabel="Sign in"
          onPress={() => router.back()}
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
        onChangeText={editPassword}
        placeholder="Choose a password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        error={
          fieldIssue?.field === "password" ? fieldIssue.message : undefined
        }
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        textContentType="newPassword"
        returnKeyType="next"
        editable={!isSubmitting}
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <TextField
        ref={confirmRef}
        label="Confirm password"
        icon="lock-closed-outline"
        value={confirmPassword}
        onChangeText={editConfirmPassword}
        placeholder="Repeat your password"
        error={
          fieldIssue?.field === "confirmPassword"
            ? fieldIssue.message
            : undefined
        }
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        textContentType="newPassword"
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
        label="Create account"
        size="lg"
        onPress={submit}
        loading={isSubmitting}
        disabled={!canSubmit}
        fullWidth
      />
    </AuthScaffold>
  );
}
