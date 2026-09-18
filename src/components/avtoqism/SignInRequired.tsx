import { Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";

import { EmptyState, Page } from "./Page";
import { useT } from "@/lib/i18n";

/** Shown instead of a protected screen when there is no session. */
export function SignInRequired() {
  const t = useT();
  return (
    <Page>
      <EmptyState
        title={t("auth.required")}
        subtitle={t("auth.requiredSub")}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              <LogIn className="size-4" /> {t("auth.login")}
            </Link>
            <Link
              to="/register"
              className="border border-border-strong bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              {t("auth.register")}
            </Link>
          </div>
        }
      />
    </Page>
  );
}
