import * as Sentry from "@sentry/react-native";
import { jobEvents } from "./JobRuntime";

export function wireSentry() {
  jobEvents.on("step:start", (e) =>
    Sentry.addBreadcrumb({
      category: "job",
      level: "info",
      message: "step:start",
      data: e,
    }),
  );
  jobEvents.on("step:success", (e) =>
    Sentry.addBreadcrumb({
      category: "job",
      level: "info",
      message: "step:success",
      data: e,
    }),
  );
  jobEvents.on("step:error", (e) => {
    Sentry.addBreadcrumb({
      category: "job",
      level: "error",
      message: "step:error",
      data: { ...e, error: String(e.error) },
    });
    Sentry.captureException(e.error, (scope) => {
      scope.setTags({ jobType: e.type, step: e.step });
      scope.setContext("job", e);
      return scope;
    });
  });
  jobEvents.on("job:failed", (e) =>
    Sentry.captureMessage(`job:failed ${e.type}`, {
      level: "error",
      contexts: { job: e },
    }),
  );
}
