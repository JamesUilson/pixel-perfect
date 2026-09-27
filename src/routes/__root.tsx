import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BottomNav, TopBar } from "@/components/avtoqism/Chrome";
import { Toaster } from "@/components/ui/sonner";
import { LangProvider } from "@/lib/i18n";
import { UiStateProvider } from "@/lib/store";

/** The feed is full-bleed, so it draws its own header instead of the top bar.
 *  It keeps the shared bottom bar unchanged: a second bar of its own is what
 *  made the navigation change shape between screens. */
const TOPBARLESS_ROUTES = ["/feed"];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="max-w-md text-center">
        <p className="type-label text-primary">404</p>
        <h1 className="type-h1 mt-3">Sahifa topilmadi</h1>
        <p className="type-caption mt-3">
          Siz qidirgan sahifa o'chirilgan yoki manzil noto'g'ri kiritilgan bo'lishi mumkin.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Bosh sahifaga qaytish
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="max-w-md text-center">
        <h1 className="type-h2">Sahifa yuklanmadi</h1>
        <p className="type-caption mt-3">Vaqtinchalik nosozlik yuz berdi. Qayta urinib ko'ring.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              void router.invalidate();
              reset();
            }}
            className="bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Qayta urinish
          </button>
          <a
            href="/"
            className="border border-border-strong bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Bosh sahifa
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AVTOQISM — Avtomobilingiz uchun aniq tanlov" },
      {
        name: "description",
        content:
          "Garajingizga mashinangizni qo'shing va faqat mos keladigan ehtiyot qismlarni ko'ring. Toshkentdagi ishonchli sotuvchilar, tekshirilgan moslik, tez yetkazib berish.",
      },
      { name: "theme-color", content: "#faf8f5" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "AVTOQISM" },
      { property: "og:locale", content: "uz_UZ" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AppChrome() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const bare = TOPBARLESS_ROUTES.some((p) => pathname.startsWith(p));

  if (bare) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <main id="main" className="flex-1">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Asosiy qismga o'tish
      </a>
      <TopBar />
      <main id="main" className="flex-1 pb-24 lg:pb-12">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <UiStateProvider>
          <AppChrome />
          <Toaster position="top-center" />
        </UiStateProvider>
      </LangProvider>
    </QueryClientProvider>
  );
}
