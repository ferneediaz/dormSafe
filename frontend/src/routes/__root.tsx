import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

import { AppHeader } from "@/components/dorm/AppHeader";
import { DormProvider } from "@/lib/dorm-store";
import { I18nProvider } from "@/lib/i18n";
import { reportLovableError } from "@/lib/lovable-error-reporting";

import appCss from "@/styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DormSafe 宿安 — Taiwan Dormitory Safety & Emergency Management" },
      { name: "description", content: "Real-time dormitory emergency accountability, Taiwan NCDR alerts, and NFA open shelters." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" },
    ],
  }),
  component: RootComponent,
  onError: (error) => {
    reportLovableError(error);
  },
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20">
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <DormProvider>
              <div className="flex min-h-screen flex-col">
                <AppHeader />
                <div className="flex-1">
                  <Outlet />
                </div>
              </div>
            </DormProvider>
          </I18nProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
